const crypto = require('crypto');

// Validates Telegram WebApp initData
function validateTelegram(initData) {
    const BOT_TOKEN = process.env.BOT_TOKEN;
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');

    // Sort parameters
    const sorted = Array.from(params.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');

    const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(BOT_TOKEN)
        .digest();

    const computedHash = crypto
        .createHmac('sha256', secretKey)
        .update(sorted)
        .digest('hex');

    if (computedHash !== hash) return null;

    try {
        return JSON.parse(params.get('user'));
    } catch(e) {
        return null;
    }
}

module.exports = async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { initData } = req.body;
    const user = validateTelegram(initData);

    if (!user) {
        return res.status(401).json({ error: 'Invalid Telegram auth' });
    }

    return res.status(200).json({ user });
};

// Export validator for other API routes to use
module.exports.validateTelegram = validateTelegram;
 
