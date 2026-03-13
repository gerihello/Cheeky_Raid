const supabase = require('../lib/supabase');
const { validateTelegram } = require('./auth');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // Authenticate
    const { initData } = req.body;
    const tgUser = validateTelegram(initData);
    if (!tgUser) return res.status(401).json({ error: 'Unauthorized' });

    try {
        // Check if player exists
        let { data: player } = await supabase
            .from('players')
            .select('*')
            .eq('telegram_id', tgUser.id)
            .single();

        if (!player) {
            // Create new player
            const { data: newPlayer, error } = await supabase
                .from('players')
                .insert({
                    telegram_id: tgUser.id,
                    username: tgUser.username || null,
                    display_name: tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : ''),
                    photo_url: tgUser.photo_url || null,
                    coins: 1000,
                    vault_level: 1,
                    defense_power: 10,
                    streak: 0
                })
                .select()
                .single();

            if (error) throw error;
            player = newPlayer;
        } else {
            // Update name/photo in case they changed
            await supabase
                .from('players')
                .update({
                    username: tgUser.username || player.username,
                    display_name: tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : ''),
                    photo_url: tgUser.photo_url || player.photo_url,
                    updated_at: new Date().toISOString()
                })
                .eq('telegram_id', tgUser.id);
        }

        // Get recent raids against this player
        const { data: recentRaids } = await supabase
            .from('raids')
            .select('*, attacker:players!attacker_id(display_name, username)')
            .eq('defender_id', tgUser.id)
            .order('created_at', { ascending: false })
            .limit(10);

        return res.status(200).json({
            player,
            recentRaids: recentRaids || []
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
    }
};
 
