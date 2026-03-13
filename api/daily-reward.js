const supabase = require('../lib/supabase');
const { validateTelegram } = require('./auth');

const REWARDS = [
    { day: 1, coins: 100 },
    { day: 2, coins: 250 },
    { day: 3, coins: 500 },
    { day: 4, coins: 750 },
    { day: 5, coins: 1000 },
    { day: 6, coins: 1500 },
    { day: 7, coins: 3000 },
];

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { initData } = req.body;
    const tgUser = validateTelegram(initData);
    if (!tgUser) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const { data: player } = await supabase
            .from('players')
            .select('*')
            .eq('telegram_id', tgUser.id)
            .single();

        if (!player) return res.status(404).json({ error: 'Player not found' });

        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        // Already claimed today?
        if (player.last_daily_claim === today) {
            return res.status(200).json({
                canClaim: false,
                streak: player.streak,
                dayIndex: player.streak % 7,
                message: 'Already claimed today'
            });
        }

        // Calculate new streak
        let newStreak;
        if (player.last_daily_claim === yesterday) {
            newStreak = player.streak + 1;
        } else {
            newStreak = 1; // Reset streak
        }

        const dayIndex = (newStreak - 1) % 7;
        const reward = REWARDS[dayIndex];

        // Update player
        const { data: updated } = await supabase
            .from('players')
            .update({
                coins: player.coins + reward.coins,
                streak: newStreak,
                last_daily_claim: today,
                updated_at: new Date().toISOString()
            })
            .eq('telegram_id', tgUser.id)
            .select()
            .single();

        // Log the claim
        await supabase
            .from('daily_claims')
            .insert({
                telegram_id: tgUser.id,
                day_number: dayIndex + 1,
                coins_awarded: reward.coins
            });

        return res.status(200).json({
            canClaim: false, // just claimed
            claimed: true,
            streak: newStreak,
            dayIndex: dayIndex,
            coinsAwarded: reward.coins,
            newBalance: updated.coins
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
    }
};
 
