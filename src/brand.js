/**
 * GAELWORX brand — single source of truth for the copy deck.
 * The Clan Voice. Sales-journey sequence (locked): Pain/reframe → Enemy → Identity →
 * Proof → De-risk → Future-state → CTA. Pricing lives only on /pricing (never the hero).
 */

export const NAV = [
  ['00', 'Home', '/'],
  ['01', 'Voice', '/voice'],
  ['02', 'Software', '/software'],
  ['03', 'Automations', '/automations'],
  ['04', 'Web', '/web'],
  ['05', 'Work', '/work'],
  ['06', 'Pricing', '/pricing'],
  ['07', 'About', '/about'],
  ['08', 'Contact', '/contact'],
]

export const COPY = {
  mark: 'GAELWORX · ONE FORGE',

  // HERO — the reframe: AI-hype is the villain, execution is the product.
  hero: {
    eyebrow: 'Four Branches · One Forge',
    pre: 'Your business doesn’t need artificial intelligence. It needs—',
    headline: 'Automatic Execution',
    sub: 'One system that books the jobs, answers every call, and kills the busywork — running while you sleep. You command it. It never needs managing.',
    cta: 'Start the Forge',
  },

  // ENEMY — name what we are not.
  enemy: 'Most agencies bill for motion. We bill for execution. The difference is whether it ships.',

  // THE CLAN — identity first, then the guide, then enterprise credibility.
  clan: {
    kicker: '01 · The Clan',
    head: 'For operators who refuse to lose to the status quo.',
    body: 'GAELWORX runs this exact system on our own shops — YardWorx, RepairWorx, SalesWorx, AgentWorx. We built it for us. It worked. Now it’s yours. We point Claude, Gemini, and enterprise-grade AI at the work eating your week — the same rails that move bank transactions and logistics fleets, aimed at your operation. Not your average agency: we don’t bill for motion, we bill for execution. You talk to the people who write the code.',
  },

  // THE ARSENAL — Voice first (entry rung, sharpest pain). Each card opens on the pain.
  arsenal: {
    kicker: '02 · The Arsenal',
    head: 'Four branches. One forge.',
    intro: 'Name the thing eating your week. We build the system that ends it.',
    branches: [
      {
        id: 'GW–01',
        tag: 'Voice',
        line: 'Every missed call is a job booked by someone else.',
        body: 'Maeve works the phones for you — answers every inbound call and runs your outbound list: qualifies the lead, books the job, chases the no-show, in a voice no caller clocks as AI. She runs our own front desk. Put her on yours and the phone stops going to voicemail.',
        path: '/voice',
      },
      {
        id: 'GW–02',
        tag: 'Software',
        line: 'You don’t own your stack. Someone else’s roadmap runs your business.',
        body: 'Internal tools and proprietary platforms — custom-built, documented, and open-sourced to you. You own the code, not a license: no lock-in, no black box. The same system that runs YardWorx, built for how you actually work.',
        path: '/software',
      },
      {
        id: 'GW–03',
        tag: 'Automations',
        line: 'You’re doing by hand what should run itself.',
        body: 'Quoting, follow-up, invoicing, reviews — running on their own, and handing your data back to you to own. No black box. No hostage tool. The same automations that run our own shops.',
        path: '/automations',
      },
      {
        id: 'GW–04',
        tag: 'Web',
        line: 'Your site looks good. It books nothing.',
        body: 'A cinematic site that routes every lead straight to your phone and books the truck — not one that just looks good. Built to the standard of the page you’re reading.',
        path: '/web',
      },
    ],
  },

  // THE TRUST LADDER — five rungs, each kills one objection in sequence.
  trust: {
    kicker: 'Why GAELWORX',
    rungs: [
      { n: '01', head: 'We build what we run.', body: 'Every build starts from years on the floor — we’ve run the operation, not read the case study. We worked the bottlenecks we automate, so you never pay us to learn your business on your dime.' },
      { n: '02', head: 'Built on enterprise ground.', body: 'We run Claude, Gemini, and the same battle-tested rails that move bank transactions and logistics fleets — not last quarter’s frontier model and a crossed-fingers prompt. Proven ground, predictable behavior, nothing held together with hope.' },
      { n: '03', head: 'No black box.', body: 'AI does the rote work. You keep the call. No machine making decisions you can’t see or override. It shows its reasoning, and hands the call back to you. Built to make you sharper, not dependent.' },
      { n: '04', head: 'It ships. Then it earns.', body: 'No pilots that rot in “phase two.” We put it live, it runs the work, and it pays for itself — counted in jobs booked, calls answered, hours handed back. Picture next Monday: the queue triaged itself overnight, the phone never hit voicemail, and you ran the day instead of the day running you.' },
      { n: '05', head: 'We carry the risk.', body: 'Fixed scope. Fixed price. Working on day one. We don’t bill the balance until it executes. We don’t get paid to experiment on your business. The risk is ours. That’s the point.' },
    ],
  },

  // THE FINALE — identity close + honest scarcity + the soft on-ramps.
  finale: {
    mark: 'GAELWORX',
    closer: 'Point the sword. We take care of the rest.',
    scarcity: 'We take 2 builds a quarter. That’s not a line — it’s how we hold the standard.',
    avail: 'Available · Continental US · 7 Days',
    cta: 'Start the Forge',
  },

  footer: {
    mark: 'GAELWORX · One Forge',
    tag: 'You run the business. We build the systems that run it for you.',
  },
}
