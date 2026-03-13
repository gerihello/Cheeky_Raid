const supabase = require('../lib/supabase');
const { validateTelegram } = require('./auth');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { initData } = req.body;
    const tgUser = validateTelegram(initData);
    if (!tgUser) return res.status(401).json({ error: 'Unauthorized' });

    try {
        // Get attacker
        const { data: attacker } = await supabase
            .from('players')
            .select('*')
            .eq('telegram_id', tgUser.id)
            .single();

        if (!attacker) return res.status(404).json({ error: 'Player not found' });

        // Find a random target (not self, has coins)
        const { data: targets } = await supabase
            .from('players')
            .select('*')
            .neq('telegram_id', tgUser.id)
            .gt('coins', 100)
            .limit(20);

        if (!targets || targets.length === 0) {
            // No real players available - return a bot raid
            return res.status(200).json({
                success: true,
                coinsStolen: Math.floor(Math.random() * 300) + 50,
                defender: {
                    display_name: 'Shadow Vault',
                    vault_level: 1
                },
                isBot: true
            });
        }

        // Pick random target
        const defender = targets[Math.floor(Math.random() * targets.length)];

        // Calculate raid outcome
        const attackPower = Math.random() * 100;
        const defensePower = defender.defense_power + (defender.vault_level * 10);
        const defenseRoll = Math.random() * defensePower;

        const success = attackPower > defenseRoll * 0.6;

        let coinsStolen = 0;

        if (success) {
            // Steal 5-15% of defender's coins
            const stealPercent = 0.05 + Math.random() * 0.10;
            coinsStolen = Math.floor(defender.coins * stealPercent);
            coinsStolen = Math.max(coinsStolen, 10); // minimum 10
            coinsStolen = Math.min(coinsStolen, 5000); // cap at 5000

            // Transfer coins
            await supabase
                .from('players')
                .update({
                    coins: attacker.coins + coinsStolen,
                    total_raids: attacker.total_raids + 1,
                    total_stolen: attacker.total_stolen + coinsStolen,
                    updated_at: new Date().toISOString()
                })
                .eq('telegram_id', tgUser.id);

            await supabase
                .from('players')
                .update({
                    coins: Math.max(0, defender.coins - coinsStolen),
                    total_lost: defender.total_lost + coinsStolen,
                    updated_at: new Date().toISOString()
                })
                .eq('telegram_id', defender.telegram_id);
        } else {
            // Failed raid - still counts
            await supabase
                .from('players')
                .update({
                    total_raids: attacker.total_raids + 1,
                    updated_at: new Date().toISOString()
                })
                .eq('telegram_id', tgUser.id);
        }

        // Log the raid
        await supabase
            .from('raids')
            .insert({
                attacker_id: tgUser.id,
                defender_id: defender.telegram_id,
                coins_stolen: coinsStolen,
                success
            });

        return res.status(200).json({
            success,
            coinsStolen,
            defender: {
                display_name: defender.display_name,
                username: defender.username,
                vault_level: defender.vault_level,
                defense_power: defender.defense_power
            },
            newBalance: success ? attacker.coins + coinsStolen : attacker.coins,
            isBot: false
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
    }
};
 
