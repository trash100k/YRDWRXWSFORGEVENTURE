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

// Inner-page copy deck (the chambers). Pricing NUMBERS live only on /pricing.
export const PAGES = {
  '/voice': {
    kicker: 'GW–01 · Voice',
    title: 'Maeve',
    lede: 'Every missed call is a job booked by someone else. Maeve works the phones — inbound and outbound — qualifies the lead, books the job, chases the no-show, in a voice no caller clocks as AI.',
    cta: 'Deploy Maeve',
    sections: [
      { h: 'She never clocks out.', b: 'An in-house rep costs $50,000+ a year and dials eighty times a day. Maeve dials a thousand, answers every inbound call, and works the night shift you can’t. She runs our own front desk — put her on yours and the phone stops going to voicemail.' },
      { h: 'What she does.', b: 'Answers every call, qualifies the lead, books straight into your calendar, and chases the no-show. Inbound reception and outbound sales — one agent, one voice, no caller the wiser.' },
      { h: 'Built on enterprise ground.', b: 'Maeve runs on Claude, Gemini, and the same rails that move bank transactions — not last quarter’s frontier model and a crossed-fingers prompt. Proven ground, predictable behavior, nothing held together with hope.' },
    ],
  },
  '/software': {
    kicker: 'GW–02 · Software',
    title: 'Custom Software',
    lede: 'You don’t own your stack. Someone else’s roadmap runs your business. We build the platform that runs it your way — and hand you the keys.',
    cta: 'Start the Forge',
    sections: [
      { h: 'You own the code, not a license.', b: 'Internal tools and proprietary platforms — custom-built, documented, and open-sourced to you. No lock-in, no black box, no rented roadmap. The same system that runs YardWorx, built for how you actually work.' },
      { h: 'It ships in stages you can see.', b: 'No year of silence, no pilot that rots in phase two. Fixed scope, fixed price, milestones you watch land. We don’t bill the balance until it executes.' },
    ],
  },
  '/automations': {
    kicker: 'GW–03 · Automations',
    title: 'Automations',
    lede: 'You’re doing by hand what should run itself. Quoting, follow-up, invoicing, reviews — we put the rote work on autopilot and hand your data back to you to own.',
    cta: 'Start the Forge',
    sections: [
      { h: 'The busywork runs itself.', b: 'Quoting, follow-up, invoicing, and review collection — running on their own, never dropping the ball. The same automations that run our own shops.' },
      { h: 'You own the data.', b: 'No black box. No hostage tool. Everything we automate hands your data back to you — to leverage like no one else can.' },
    ],
  },
  '/web': {
    kicker: 'GW–04 · Web',
    title: 'Cinematic Web',
    lede: 'Your site looks good. It books nothing. We build cinematic, avatar-level sites that route every lead straight to your phone and book the truck.',
    cta: 'Book the Build',
    sections: [
      { h: 'Built to book, not just look.', b: 'Every site routes every lead straight to your phone and is built to convert — studio-grade craft at a front-door price, to the standard of the page you’re reading.' },
      { h: 'Shipped in seven days.', b: 'Fixed scope, fixed price, live in a week. Premium studios charge $50k+ and take months. The forge runs lean.' },
    ],
  },
  '/about': {
    kicker: 'The Clan',
    title: 'One Forge. Four Branches.',
    lede: 'GAELWORX is an engineering forge, not an agency. We run our own platforms on this exact system — YardWorx, RepairWorx, SalesWorx, AgentWorx — and build the same caliber for you.',
    cta: 'Start the Forge',
    sections: [
      { h: 'We build what we run.', b: 'Every build starts from years on the floor. We worked the bottlenecks we automate, so you never pay us to learn your business on your dime.' },
      { h: 'We carry the risk.', b: 'Fixed scope. Fixed price. Working on day one. We don’t get paid to experiment on your business — we get paid when it executes. The risk is ours. That’s the point.' },
      { h: 'You talk to the forge.', b: 'No account managers. No ticket queue. You talk to the people who write the code — direct, the whole way through.' },
    ],
  },
  '/work': {
    kicker: 'The Work',
    title: 'Forged Here.',
    lede: 'We run our own platforms on the exact system we sell. These are the casts that came out of the forge.',
    cta: 'Start the Forge',
    sections: [
      { h: 'YardWorx', b: 'The platform that runs the yard — scheduling, dispatch, billing, all owned. The first system we built for ourselves, now the proof we build what we run.' },
      { h: 'RepairWorx', b: 'Repair operations end to end — intake, quoting, parts, follow-up — automated and unified.' },
      { h: 'SalesWorx', b: 'The outbound engine: Maeve on the phones, the pipeline on autopilot, the data yours.' },
      { h: 'AgentWorx', b: 'The newest cast, still glowing — agentic automation pointed at the rote work, showing its reasoning, handing the call back to you.' },
    ],
  },
}

/**
 * META — per-route document title + description (SEO/AEO). Swapped by App on route change.
 * Titles lead with the outcome, not the brand; the brand closes.
 */
export const META = {
  '/':            { title: 'GAELWORX — Automatic Execution. Clan Protected.', desc: 'One system that books the jobs, answers every call, and kills the busywork. AI voice, custom software, automations, and cinematic web — built by operators, for operators.' },
  '/voice':       { title: 'Maeve — AI Voice That Answers Every Call | GAELWORX', desc: 'Maeve works your phones: answers every inbound call, runs your outbound list, books straight to calendar — in a voice no caller clocks as AI.' },
  '/software':    { title: 'Custom Software You Own Outright | GAELWORX', desc: 'Internal tools and platforms custom-built, documented, and open-sourced to you. No lock-in, no black box, no rented roadmap.' },
  '/automations': { title: 'Automations That Kill the Busywork | GAELWORX', desc: 'Quoting, follow-up, invoicing, reviews — running on their own. You own the data. The same automations that run our own shops.' },
  '/web':         { title: 'Cinematic Websites Built to Book | GAELWORX', desc: 'A cinematic 3D site that routes every lead to your phone and books the job — live in 7 days, studio-grade at a front-door price.' },
  '/work':        { title: 'The Work — YardWorx, RepairWorx, SalesWorx, AgentWorx | GAELWORX', desc: 'We run our own platforms on the exact system we sell. These are the casts that came out of the forge.' },
  '/pricing':     { title: 'Pricing — Premium Work, Honest Prices | GAELWORX', desc: 'Fixed scope, fixed price, before any work begins. Voice from $699/mo, automations from $2.5k, software from $15k, cinematic web from $1,499.' },
  '/about':       { title: 'About — One Forge, Four Branches | GAELWORX', desc: 'An engineering forge, not an agency. We build what we run, carry the risk, and you talk to the people who write the code.' },
  '/contact':     { title: 'Start the Forge — Name the Bottleneck | GAELWORX', desc: 'One call, no discovery-call theater. Name the bottleneck; we forge the system that kills it. Fixed scope and price before you owe a thing.' },
}
