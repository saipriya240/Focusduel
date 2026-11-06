import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const INTENSITIES = ['mild', 'savage', 'extra_spicy'];

const TONE = {
  mild: 'gentle teasing between friends — playful, affectionate, a light nudge',
  savage: 'sharp and witty roast-comedy energy, still friendly and clearly a joke',
  extra_spicy: 'maximum playful heat, dramatic roast-battle energy, absurd exaggeration',
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const intensity = INTENSITIES.includes(body.intensity) ? body.intensity : 'savage';
    const goal = String(body.goal_text || '').slice(0, 140);
    const actual = String(body.actual_text || '').slice(0, 140);
    const username = String(body.username || 'this contender').slice(0, 30);

    const prompt = `You are the roast host of FocusDuel, a productivity app where friends compete on focus.

Write ONE short roast (max 2 sentences, max 220 characters) for a player who missed their focus goal.

Player handle: ${username}
Goal they declared: ${goal || 'a focus session they planned'}
What actually happened: ${actual || 'they bailed on it'}

Tone: ${TONE[intensity]}.

Hard rules:
- Keep it about focus habits, procrastination and phone scrolling only.
- Absolutely no hate speech, slurs, threats, sexual content, harassment, or references to protected characteristics (race, religion, gender, sexuality, disability, nationality, age, body).
- Never mention self-harm, violence, or anyone's family.
- It must read as a joke a friend would laugh at, not an attack.
- No emojis. No hashtags. Do not quote the player's handle back more than once.
- Output only the roast text.`;

    const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: { roast: { type: 'string' } },
        required: ['roast'],
      },
    });

    const text = typeof response === 'string' ? response : response?.roast;
    const roast = String(text || '').trim().slice(0, 260);
    if (!roast) return Response.json({ error: 'Could not generate a roast, try again' }, { status: 502 });

    return Response.json({ roast, intensity });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}