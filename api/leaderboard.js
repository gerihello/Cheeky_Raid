const supabase = require('../lib/supabase');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { type = 'coins' } = req.query;

        let query = supabase
            .from('players')
            .select('telegram_id, display_name, username, photo_url, coins, total_stolen, total_raids, vault_level, streak')
            .limit(50);

        if (type === 'stolen') {
            query = query.order('total_stolen', { ascending: false });
        } else if (type === 'raids') {
            query = query.order('total_raids', { ascending: false });
        } else {
            query = query.order('coins', { ascending: false });
        }

        const { data, error } = await query;

        if (error) throw error;

        return res.status(200).json({
            leaderboard: data,
            type
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
    }
};
 
