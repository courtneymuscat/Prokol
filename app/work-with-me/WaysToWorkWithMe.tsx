'use client'

import { useState } from 'react'
import { InquiryButton } from '@/app/components/InquiryForm'

const INK = '#211A17'
const INK_SOFT = 'rgba(33,26,23,0.62)'
const BERRY = '#1D9E75'
const BERRY_DEEP = '#0F6E56'
const HEAD = 'var(--font-sans, Geist, system-ui, sans-serif)'

type ServiceKey = 'coaching' | 'education' | 'gyms' | 'seminars' | 'consulting'

const BUBBLES: { key: ServiceKey; label: string }[] = [
  { key: 'coaching', label: '1:1 Nutrition Coaching' },
  { key: 'education', label: 'The Prokol Method' },
  { key: 'gyms', label: 'Gym & Studio Partnerships' },
  { key: 'seminars', label: 'Seminars, Workshops & Webinars' },
  { key: 'consulting', label: 'Food Business Consulting' },
]

const COACHING_TIERS = [
  {
    tag: 'One-off · no ongoing commitment',
    title: 'Nutrition Plan',
    price: '$397',
    priceNote: 'AUD, one-off, paid upfront',
    desc: 'A plan built around you, without ongoing support — for anyone who wants clear answers and is happy to put them into practice on their own.',
    points: [
      'Intake form, symptom analysis and 5-day food log reviewed',
      'A consult call about your goals, training and lifestyle',
      'Your plan in the Prokol app 2 to 3 business days after the call',
      'Add follow-up calls whenever you need them',
    ],
    bestFor: 'Also a good way to try working with me before committing to 12 weeks.',
    button: 'Enquire about a Nutrition Plan',
    service: '1:1 Coaching — Nutrition Plan',
  },
  {
    tag: 'One-off · bloods included',
    title: 'Blood Analysis + Plan',
    price: '$1,097',
    priceNote: 'AUD, one-off, paid upfront',
    desc: 'Your bloods, symptoms and food log read together through a nutrition lens, explained on a results call, with a plan built around what we find.',
    points: [
      'Full blood panel (bloods included), ordered for you with a Bloodwork Manual on how to prepare',
      'Everything in the Nutrition Plan — intake, symptom analysis and 5-day food log reviewed together',
      'A results call once your bloods are in (I need 1 to 2 business days with them first)',
      'Your plan in the Prokol app 2 to 3 business days after the call',
      'Cycle and hormone considerations built into your plan, if relevant',
      'Supplement suggestions based on your bloods, training and goals',
      'A plain-words summary of what your results mean for your nutrition',
    ],
    bestFor: 'Best suited to anyone with bloodwork they’d like to understand, who’s happy to put the plan into practice on their own.',
    button: 'Enquire about Blood Analysis + Plan',
    service: '1:1 Coaching — Blood Analysis + Plan',
  },
  {
    tag: 'Highest level of support · 12 weeks',
    title: 'The Full Reset',
    price: '$2,997',
    priceNote: 'AUD upfront, or 3 payments of $1,049',
    desc: '12 weeks of 1:1 coaching to find what’s driving how you feel and fix it at the source. Your bloods, symptoms and food log are read together, then we build and adjust your plan week by week.',
    points: [
      'Full blood panel (bloods order included in pricing), read through a nutrition lens',
      'Intake form, symptom analysis and 5-day food log reviewed together',
      'Strategy call around day 8 to 10 (once results are in), then your plan 2 to 3 business days later',
      'Weekly 30-minute calls, with a written summary after each one',
      'Weekly check-ins (in by Monday, feedback Tuesday) and messaging in the Prokol app',
      'Cycle-informed fuelling if you have a cycle, and support through perimenopause or menopause',
      'Supplement suggestions based on your bloods, training and goals',
      'Education on your body, so you understand the why behind every change',
    ],
    bestFor: 'Best suited to athletes and active women who want their cycle, energy and recovery working with them, and anyone who wants the most hands-on support.',
    footnote: 'After your 12 weeks: keep going on Continuation at $497 a month, or see the change in your bloods with a 12-week retest, $549 (plan and bloods included).',
    button: 'Enquire about the Full Reset',
    service: '1:1 Coaching — The Full Reset',
    highlight: true,
  },
  {
    tag: 'After your Full Reset',
    title: 'Continuation',
    price: '$497',
    priceNote: '/ month AUD — cancel with 14 days’ notice',
    desc: 'For clients who’ve finished their 12-week Full Reset and want to keep going, with less contact but the same accountability.',
    points: [
      'Fortnightly 30-minute calls, with a written summary after each one',
      'Weekly check-ins (in by Monday, feedback Tuesday)',
      'Messaging in the Prokol app, replies within 2 business days',
      'Your plan tweaked as you go; a full rebuild or 12-week retest can be added',
    ],
    bestFor: 'Best suited to clients whose foundations are steady and who want support while we work on the next phase. If a big change is still settling — new medication, pre-conception, a postpartum return — we’d talk first about the right support.',
    requires: 'Only available after the Full Reset — if you haven’t done it yet, start there first',
    button: 'Enquire about Continuation',
    service: '1:1 Coaching — Continuation',
  },
]

const HOW_IT_WORKS = [
  { n: '01', t: 'Discovery call', d: 'We talk about your goals, training, health and lifestyle, and work out which option fits you best.' },
  { n: '02', t: 'Sign-up + onboarding', d: 'Your welcome steps, intake form and symptom analysis unlock in the Prokol app. Payment is confirmed here.' },
  { n: '03', t: 'Food log + bloods', d: 'Log your food for 5 days in the app — photos, times, rough amounts — and get your bloods done in your first week, if they’re part of your option.' },
  { n: '04', t: 'Strategy call + your plan', d: 'Around day 8 to 10, once your results are in (I need 1 to 2 business days with them). Your plan lands in the app 2 to 3 business days after the call.' },
  { n: '05', t: 'Ongoing support', d: 'Full Reset: weekly 30-minute calls, check-ins and messaging. Continuation: fortnightly calls and weekly check-ins. Blood Analysis + Plan: one-off, with a results call. Nutrition Plan: one-off, with follow-up calls if you need them.' },
  { n: '06', t: 'Progress + refinement', d: 'Your plan evolves with you — updates, adjustments and guidance based on progress. How often depends on the option you choose.' },
]

const COACHING_ADDONS = [
  { title: 'Follow-up call', price: '$129', priceNote: 'per call', desc: 'A question or a tweak later on, on any option.' },
  { title: 'Plan change', price: '$99', priceNote: 'small change · $199 rebuild', desc: 'A small adjustment to your existing plan, or a full rebuild from scratch.' },
  { title: '12-week retest', price: '$549', priceNote: 'plan and bloods included', desc: 'Repeat your blood panel after the Full Reset and see what actually changed.' },
]

// The columns of the comparison table, in the same order as COACHING_TIERS.
const COMPARE_COLUMNS = ['Nutrition Plan', 'Blood Analysis + Plan', 'The Full Reset', 'Continuation']

const COMPARE_ROWS: { label: string; cells: string[] }[] = [
  { label: 'Price', cells: ['$397', '$1,097', '$2,997', '$497 / mo'] },
  { label: 'Format', cells: ['One-off, paid upfront', 'One-off, bloods included', '12 weeks, 1 or 3 payments', 'Monthly, 14 days’ notice'] },
  { label: 'Bloods', cells: ['Not included', 'Included in the fee', 'Included in the pricing', 'Retest can be added'] },
  { label: 'Live calls', cells: ['1 consult call', '1 results call', 'Weekly, 30 min', 'Fortnightly, 30 min'] },
  { label: 'Weekly check-ins', cells: ['Not included', 'Not included', 'In by Monday, feedback Tuesday', 'In by Monday, feedback Tuesday'] },
  { label: 'Messaging access', cells: ['Not included', 'Not included', 'In app, within 2 business days', 'In app, within 2 business days'] },
  { label: 'Best for', cells: ['Wants a plan, happy to go it alone', 'Wants bloods understood, plus a plan', 'Symptoms to untangle, wants weekly support', 'Finished the Reset, wants to keep going'] },
]

const COACHING_DISCLAIMER =
  'I’m an Accredited Sports Nutritionist. Blood work, biofeedback and cycle data are interpreted for nutrition and performance optimisation only — not for medical diagnosis or treatment. I refer to GPs, endocrinologists and sports doctors where appropriate, and work alongside your medical team, not in place of them.'

const GYM_STATS = [
  { n: '1', label: 'nutritionist on hand, all year' },
  { n: '35', label: 'minutes a week for members' },
  { n: '41', label: 'built-in safety flags' },
]

// The gym brochure, once it's uploaded and shared. Its buttons stay hidden
// until this is filled in rather than linking nowhere.
const GYM_BROCHURE_URL: string = ''

const GYM_PROBLEM = [
  { t: 'What you\u2019ve tried', d: 'Another challenge. More classes. A discount to win them back. It works for a few weeks, then they drift off again.' },
  { t: 'Why they really leave', d: 'It\u2019s not your training. They stop feeling the benefit, because results are mostly made in the 23 hours they\u2019re not in your gym.' },
  { t: 'What your coaches hear', d: '\u201cWhat should I eat?\u201d Every day. Your coaches don\u2019t have the time to answer it properly, so members guess and stall.' },
  { t: 'Then they quietly cancel.', d: 'No complaint, no warning. They miss a session, then a week, stop seeing results and cancel. Numbers dip, and you\u2019re back to chasing sign-ups just to stand still.', highlight: true },
]

const GYM_FIX_CARDS = [
  { t: 'The fix', d: 'A nutritionist on hand for every member. They get a plan with real targets, are taught the why behind it, and can ask questions any time. When things change, so does their plan.' },
  { t: 'Why they stay', d: 'Understanding creates buy-in. Buy-in builds consistent habits. Pair that with your coaching and facilities, and members see results, feel it working and stay.' },
]

const GYM_MEMBER_FEATURES = [
  { t: 'A nutritionist on hand', d: 'I answer members\u2019 questions every week, all year.' },
  { t: 'Their plan + macros', d: 'Real targets from their intake, updated as goals change.' },
  { t: 'Progress reviews', d: 'Weekly for 13 weeks, then monthly and bi-monthly to keep habits on track.' },
  { t: 'All-in-one nutrition app', d: 'Food, progress and cycle tracking, for as long as your gym subscribes.' },
  { t: 'Weekly recorded Q&A', d: 'Ask any time; I answer on video every week.' },
  { t: 'Bonus: 25 video lessons', d: 'Plus 24 guides, theirs to keep.' },
  { t: 'Women\u2019s health library', d: 'Cycle, iron, energy, menopause and bloodwork basics.' },
  { t: 'Health flags caught', d: 'Flagged progress checks get next steps, and a GP or support referral where needed.' },
]

const GYM_TIERS = [
  {
    tag: 'Every member included',
    title: 'Nutritionist',
    subtitle: 'A nutritionist on hand, every flag seen',
    priceLabel: 'Flat monthly fee \u00b7 up to 150 members',
    price: '$900',
    priceNote: 'onboarding + $349 / month',
    priceWeekly: 'About $2.33 a member a month',
    desc: 'Every member gets their plan and macros, the Prokol app, progress reviews, the weekly recorded Q&A and the bonus lessons. Questions are answered as a group in the weekly Q&A. I see every flag and personally review every intake health screen, and reply if a GP or support referral is needed.',
    points: [
      'Their plan, macros and targets from their intake form',
      'Progress reviews: weekly for 13 weeks, then monthly and bi-monthly',
      'Weekly recorded Q&A \u2014 I answer members\u2019 questions on video',
      '25 video lessons and 24 guides, plus the women\u2019s health library',
      'Some flags give an automated tip and next steps',
      'I see every flag and personally review every intake health screen',
    ],
    button: 'Book a call',
    service: 'Gym & Studio Partnerships',
  },
  {
    tag: 'Most support \u00b7 about $2 more a member',
    title: '+ Personal Replies',
    subtitle: 'I answer every member\u2019s questions myself',
    priceLabel: 'Add-on \u00b7 on top of Nutritionist',
    price: '+$450',
    priceNote: 'onboarding + $299 / month',
    priceWeekly: '$648 / month all up, about $4.32 a member',
    desc: 'Everything in Nutritionist, plus a personal reply from me on every question and every flagged progress review, within 2\u20133 business days.',
    points: [
      'Everything in Nutritionist',
      'A personal reply from me on every member question',
      'A personal reply on every flagged progress review, within 2\u20133 business days',
    ],
    button: 'Book a call',
    service: 'Gym & Studio Partnerships',
    highlight: true,
  },
]

const GYM_WHATS_INCLUDED = [
  { label: 'Your own branded app', d: 'M7.5 21H16.5C17.3284 21 18 20.3284 18 19.5V4.5C18 3.67157 17.3284 3 16.5 3H7.5C6.67157 3 6 3.67157 6 4.5V19.5C6 20.3284 6.67157 21 7.5 21Z M12 17.25H12.0075' },
  { label: 'Simple monthly report', d: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { label: 'Gym Toolkit, including launch copy', d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { label: 'Zero extra time from your trainers', d: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
]

const GYM_FLAG_CATEGORIES = [
  { n: '1', t: 'Weekly wellbeing', d: 'Energy, sleep, stress, hunger, habits and weight change.' },
  { n: '2', t: 'Safety screening', d: 'Exercise readiness and food allergies at sign-up.' },
  { n: '3', t: 'Women\u2019s health', d: 'Health history, pregnancy and cycles. Reviewed by me, with a GP referral if needed.' },
  { n: '4', t: 'Extra support', d: 'An upcoming event, feeling stuck or wanting more help.' },
  { n: '5', t: 'Week-specific', d: 'Under-fuelling, digestion, run-down and supplement safety.' },
  { n: '6', t: 'Tracking and mindset', d: 'Tracking anxiety, all-or-nothing thinking and rigid rules.' },
]

// How a progress check is actually handled, by outcome.
const GYM_FLAG_HANDLING = [
  { t: 'Nothing flagged', d: 'No message. Questions are answered in the weekly Q&A, or by me with Personal Replies.' },
  { t: 'Flagged answer', d: 'Some flags give an automated tip and next steps. With Personal Replies, I reply too.' },
  { t: 'Initial health screen', d: 'Always reviewed by me. A personal reply only if a GP or support-line referral is needed.' },
]

// Paid by the member (or covered by the gym), on top of the gym's fee.
const GYM_ADDONS = [
  {
    title: 'Personalised 1:1',
    price: 'from $397',
    priceNote: 'the member pays',
    desc: 'Nutrition plans with or without bloods, cycle and bloodwork education, and the 12-week Full Reset from $2,997.',
  },
  {
    title: 'Consults',
    price: '$50',
    priceNote: 'per 20 minutes',
    desc: 'Current issues and a written summary, in person at your gym or online. Members pay, or your gym covers them.',
  },
]

const GYM_HOW_IT_WORKS = [
  { n: '01', t: 'Set-up week', d: 'I brand your app and send your Gym Toolkit.' },
  { n: '02', t: 'Members join', d: 'With your gym\u2019s own code.' },
  { n: '03', t: 'Onboarding', d: 'Every current member set up and overseen.' },
  { n: '04', t: 'Then all year', d: 'New members from day one, questions answered every week.' },
]

const GYM_FAQS = [
  { q: 'Is this medical advice?', a: 'No. It\u2019s nutrition education from an accredited sports nutritionist. Anything medical goes to the member\u2019s GP, and your Gym Toolkit gives your team the referral steps.' },
  { q: 'What happens if something\u2019s flagged?', a: 'Some flags give an automated tip and next steps. I see every flag, and if a GP or support-line referral is needed, I reply personally. With Personal Replies, I reply to every flagged progress review.' },
  { q: 'How many members does this cover?', a: 'Up to 150 members for the monthly fee. Over 150, it\u2019s +$2 a member (+$4 with Personal Replies).' },
  { q: 'What\u2019s the commitment?', a: 'A one-off onboarding fee, then monthly from day one with 30 days\u2019 notice.' },
  { q: 'How much time does it take members?', a: 'About 35 minutes a week: a 20-minute lesson, 15 minutes to plan their week, one small daily habit and a progress check.' },
  { q: 'Does this replace our trainers?', a: 'No. Your coaches keep coaching. When members ask \u201cwhat should I eat?\u201d, they point them to the app. The coach redirect script in your Gym Toolkit shows them how.' },
  { q: 'What do Consults include?', a: 'A 20-minute consult with me, in person at your gym or online. We talk through their plan and targets, practical questions like eating out and busy weeks, and general supplement guidance, with a written summary saved to their app. It doesn\u2019t include bloodwork review, medical or hormone advice, or event fuelling plans. $50, paid by members or covered by your gym.' },
  { q: 'Does it pay for itself?', a: 'At members paying $60 a week, keeping 2 members covers the monthly fee, and 4 more cover onboarding. Each member gets $249 of program value.' },
]

const EDUCATION_CARDS = [
  {
    tag: 'Learn at your own pace',
    title: 'Self-guided',
    subtitle: '91 days for just $249',
    priceLabel: '91 days · one payment',
    price: '$249',
    priceNote: 'for the full 91 days',
    priceWeekly: 'That’s about $19 a week',
    desc: 'Everything you need to understand nutrition and put it into practice yourself, one small step at a time.',
    points: [
      '91 days of short video lessons: Week 0 to get set up, then one new topic a week',
      'One simple habit each week, matched to the path you choose',
      'Your plan, daily serves and targets in the Prokol app, built from your onboarding answers',
      '24 downloadable guides you keep, from protein and carbs to eating out and sleep',
      'The women’s health bonus library: your cycle, iron, energy, menopause and bloodwork',
      'Weekly progress check-ins with photos, so you can see how far you’ve come',
      'Choose your path: Plan and Swap, Track Serves, or Protein + Calories',
    ],
    button: 'Start Self-guided',
    service: 'The Prokol Method — Self-guided',
  },
  {
    tag: 'Most support',
    title: 'Guided',
    subtitle: 'with weekly replies on your progress check',
    priceLabel: '91 days · one payment',
    price: '$449',
    priceNote: 'for the full 91 days, with weekly replies',
    priceWeekly: 'That’s about $35 a week',
    desc: 'Everything in Self-guided, plus me reading your check-in and replying every week, so you’re never doing it alone.',
    points: [
      'Everything in Self-guided',
      'A personal reply from me to your weekly in-app progress check, every week for 91 days',
      'Feedback on your progress photos, habits, energy, sleep and hunger',
      'Answers to your questions, so you’re never stuck figuring it out alone',
      'Course-correct early, so small slips don’t turn into big ones',
    ],
    button: 'Start Guided',
    service: 'The Prokol Method — Guided',
    highlight: true,
  },
  {
    tag: 'Add training alongside it',
    title: 'Self-guided + Training',
    subtitle: '91 days nutrition + 12 weeks training',
    priceLabel: '91 days · one payment',
    price: '$349',
    priceNote: 'for the full program',
    priceWeekly: 'That’s about $27 a week',
    desc: 'Everything in Self-guided, plus a structured training program to work alongside it, delivered the same way — in the app, at your own pace.',
    points: [
      'Everything in Self-guided',
      '2 x 6-week training blocks, delivered in the Prokol app',
      'Progressive programming that builds across both blocks',
      'Train and eat from the same plan, with nothing to coordinate yourself',
    ],
    button: 'Start Self-guided + Training',
    service: 'The Prokol Method — Self-guided + Training',
  },
  {
    tag: 'Most complete',
    title: 'Guided + Training',
    subtitle: 'with weekly replies on your progress check',
    priceLabel: '91 days · one payment',
    price: '$599',
    priceNote: 'for the full program, with weekly check-in replies',
    priceWeekly: 'That’s about $46 a week',
    desc: 'Everything in Guided, plus a structured training program and weekly replies that cover both.',
    points: [
      'Everything in Guided',
      '2 x 6-week training blocks, delivered in the Prokol app',
      'Weekly check-in replies cover your training as well as your nutrition',
      'Progressive programming that builds across both blocks',
    ],
    button: 'Start Guided + Training',
    service: 'The Prokol Method — Guided + Training',
    highlight: true,
  },
]

// The full topic overviews PDF, already shared publicly from Court's Drive.
const TOPIC_OVERVIEWS_URL = 'https://drive.google.com/file/d/12SExYXU4iqtXMDuxhTp653Mxq-IYJFqN/view?usp=sharing'

// The Individual flyer, shared publicly from Court's Drive. The brochure
// buttons render only while this is set, rather than linking nowhere.
const BROCHURE_URL: string = 'https://drive.google.com/file/d/150iFgaxGsUmZxq7HjW3JihyzpOqzUWrk/view?usp=sharing'

// The 91-day roadmap, grouped into the three months of the brochure. Week 0
// keeps its name; everything after it is a Topic, not a Week.
const ROADMAP: { month: string; days: string; topics: { label: string; title: string; hook: string; d: string }[] }[] = [
  {
    month: 'Build the base',
    days: 'Days 1–28',
    topics: [
      { label: 'Week 0', title: 'The Basics', hook: 'Not sure what a serve is, or what to actually eat?', d: 'Get set up: your plan, serves, the Cheat Sheet and your minimum day for busy weeks.' },
      { label: 'Topic 1', title: 'Protein at Every Meal', hook: 'Skipping breakfast, then starving by 3pm?', d: 'Why protein keeps you full and how to hit it without overthinking.' },
      { label: 'Topic 2', title: 'Fuel Your Training', hook: 'Flat at the gym, or raiding the pantry at night?', d: 'How to time carbs around training so you perform and recover.' },
      { label: 'Topic 3', title: 'Fibre and Gut Health', hook: 'Bloated, or eating the same few meals?', d: 'More plants, more often, and why your gut cares.' },
    ],
  },
  {
    month: 'Fit it to your life',
    days: 'Days 29–56',
    topics: [
      { label: 'Topic 4', title: 'Meals Made Simple', hook: '6pm panic, or sick of tracking?', d: 'Go-to meals and swaps that make planning quick.' },
      { label: 'Topic 5', title: 'Real Life', hook: 'Weekends, drinks or eating out undoing your week?', d: 'How to enjoy social life without starting again Monday.' },
      { label: 'Topic 6', title: 'Progress Review', hook: 'Scale won’t budge, and motivation dipping?', d: 'How to read your progress beyond the scale and adjust.' },
      { label: 'Topic 7', title: 'Supplements', hook: 'Tempted by fat burners or greens powders?', d: 'What the evidence supports, and what to skip.' },
    ],
  },
  {
    month: 'Make it yours',
    days: 'Days 57–91',
    topics: [
      { label: 'Topic 8', title: 'Hunger and Cravings', hook: 'Good all day, then the pantry wins at night?', d: 'What drives hunger and cravings, and how to work with them.' },
      { label: 'Topic 9', title: 'Body Comp Phases', hook: 'Stuck in back-to-back diets?', d: 'How fat loss, maintenance and building phases fit together.' },
      { label: 'Topic 10', title: 'Sleep, Stress and Recovery', hook: 'Wired at night, always sore or stress eating?', d: 'How sleep and stress change appetite, energy and results.' },
      { label: 'Topic 11', title: 'Ease Off', hook: 'Want to stop tracking without losing results?', d: 'Eating by cues, spot-checks and your personal reset plan.' },
      { label: 'Topic 12', title: 'Making It Last', hook: 'Worried it won’t last once the lessons end?', d: 'Pulling it together so your habits hold for the long run.' },
    ],
  },
]

const WHATS_INCLUDED = [
  { label: 'A plan to start from', d: 'Meal plan, macros and the in-app Cheat Sheet so you can build your own meals.', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { label: 'Short video lessons', d: 'About 20 minutes each, with a guide for every topic.', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
  { label: 'One habit at a time', d: 'Tick it off daily and log your data — and your cycle, if you have one.', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { label: 'Weekly progress checks', d: 'Track how you’re going with your check data and progress photos.', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { label: 'A women’s health library', d: 'Your cycle, energy, iron, perimenopause and bloodwork basics.', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
  { label: 'Optional weekly replies', d: 'Add my personal feedback on your progress check, every week — that’s Guided, $200 on top.', icon:'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
]

// What a week actually costs you — the "35 minutes" promise, broken down.
const WEEKLY_RHYTHM = [
  { when: 'Day 1', what: 'Watch the lesson (20 min), then plan your week (15 min). Knowing why is what makes it stick.' },
  { when: 'Every day', what: 'Do your one habit — small wins — and track your data, and your cycle if you have one.' },
  { when: 'Day 6', what: 'Send your progress check and photos.' },
]

const EDUCATION_FAQS = [
  { q: 'Is this personal coaching?', a: 'No. It’s nutrition education you work through at your own pace. If you want my personal feedback each week, add weekly replies. For a fully personalised plan, that’s 1:1 Nutrition Coaching.' },
  { q: 'How long do I have access?', a: 'You keep every lesson and resource after you finish, with no subscription.' },
  { q: 'What if I fall behind?', a: 'Each lesson unlocks when you finish the last, so you go at your own pace. Busy week? Do your minimum day and pick it back up.' },
  { q: 'Can I add weekly replies later?', a: 'Yes. Pay the difference at any time and your weekly replies start from your next progress check.' },
  { q: 'Is it right for medical conditions?', a: 'The Prokol Method is general education, not medical advice. Bloodwork, cycle concerns and anything medical belong with your GP, or with 1:1 coaching.' },
]

const SIMPLE_PANELS: Record<Exclude<ServiceKey, 'coaching' | 'education' | 'gyms'>, { icon: string; badge?: string; desc: string }> = {
  seminars: {
    icon: '🎤',
    desc: 'In-person talks for gyms, studios, and teams, or virtual workshops and webinars for anyone who can’t get me in the room. Practical female-health education — the same material I coach 1:1 with, just delivered to a room or a screen full of people at once.',
  },
  consulting: {
    icon: '🍱',
    desc: 'I consult with food businesses — meal prep services, cafés, health-food brands — on nutrition input, recipe development, and macro-balanced menu design. I’ve done this from the inside: I helped build Fuel by Bambu’s entire nutrition framework, working directly with chefs to turn recipes into balanced macros.',
  },
}

export default function WaysToWorkWithMe() {
  const [active, setActive] = useState<ServiceKey>('coaching')
  const activeLabel = BUBBLES.find((b) => b.key === active)?.label ?? ''

  return (
    <section className="px-6 py-20">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-4">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: BERRY }}>Ways To Work With Me</p>
          <h2 style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 'clamp(1.7rem,4vw,2.4rem)', marginBottom: 12 }}>
            Choose where to start
          </h2>
          <p style={{ color: INK_SOFT, fontWeight: 300, maxWidth: 580, margin: '0 auto' }}>
            Tap a option below to see what it actually involves.
          </p>
        </div>

        {/* Bubbles */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-10">
          {BUBBLES.map((b) => {
            const isActive = active === b.key
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => setActive(b.key)}
                className="px-5 py-3 rounded-full text-sm font-semibold transition-colors"
                style={isActive
                  ? { background: BERRY, color: '#fff' }
                  : { background: '#fff', color: INK, border: '1px solid rgba(33,26,23,0.12)' }}
              >
                {b.label}
              </button>
            )
          })}
        </div>

        {/* Expanded panel */}
        <div className="mt-14">
          {active === 'coaching' ? (
            <div>
              <p className="text-center mb-10" style={{ color: INK_SOFT, fontWeight: 300, maxWidth: 620, marginLeft: 'auto', marginRight: 'auto' }}>
                Choose the level of support that suits you: the Full Reset for 12 weeks of 1:1 coaching, or a one-off Blood Analysis + Plan or Nutrition Plan if you want answers and a plan without ongoing support.
              </p>

              {/* How it works — the six steps of the coaching journey */}
              <p className="font-bold text-lg mb-6 text-center" style={{ fontFamily: HEAD }}>Your coaching journey</p>
              <div className="grid md:grid-cols-3 gap-6">
                {HOW_IT_WORKS.map((step) => (
                  <div key={step.n}>
                    <p className="text-xs font-bold tracking-widest mb-2" style={{ color: BERRY }}>{step.n}</p>
                    <p className="font-bold mb-2" style={{ fontFamily: HEAD }}>{step.t}</p>
                    <p className="text-sm leading-relaxed" style={{ color: INK_SOFT }}>{step.d}</p>
                  </div>
                ))}
              </div>

              {/* Limited intake */}
              <div
                className="mt-10 mx-auto rounded-[1.5rem] px-7 py-6 text-center"
                style={{ background: 'rgba(29,158,117,0.08)', border: '1px solid rgba(29,158,117,0.18)', maxWidth: 620 }}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: BERRY }}>Limited intake</p>
                <p className="text-sm leading-relaxed" style={{ color: INK }}>
                  I only work with a small number of clients at a time, so I can be completely invested in your journey and deliver a truly premium, personalised experience.
                </p>
              </div>

              {/* Pricing */}
              <div className="grid md:grid-cols-2 gap-5 mt-16 pt-16" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
                {COACHING_TIERS.map((t) => (
                  <div
                    key={t.title}
                    className="rounded-2xl p-7 flex flex-col"
                    style={t.highlight ? { background: BERRY_DEEP, color: '#fff' } : { background: '#fff', border: '1px solid rgba(33,26,23,0.08)' }}
                  >
                    <span
                      className="inline-block text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full mb-4 self-start"
                      style={t.highlight ? { background: 'rgba(255,255,255,0.15)', color: '#fff' } : { background: 'rgba(29,158,117,0.1)', color: BERRY }}
                    >
                      {t.tag}
                    </span>
                    <p className="font-bold text-lg mb-3" style={{ fontFamily: HEAD }}>{t.title}</p>

                    <div className="mb-4 flex items-baseline gap-2 flex-wrap">
                      <span className="font-black" style={{ fontFamily: HEAD, fontSize: '2rem', lineHeight: 1, color: t.highlight ? '#fff' : INK }}>{t.price}</span>
                      <span className="text-xs" style={{ color: t.highlight ? 'rgba(255,255,255,0.75)' : INK_SOFT }}>{t.priceNote}</span>
                    </div>

                    {'requires' in t && t.requires && (
                      <p
                        className="text-xs font-semibold rounded-lg px-3 py-2 mb-4 flex items-start gap-1.5"
                        style={{
                          background: t.highlight ? 'rgba(255,255,255,0.1)' : 'rgba(29,158,117,0.08)',
                          color: t.highlight ? '#fff' : BERRY,
                          border: `1px solid ${t.highlight ? 'rgba(255,255,255,0.25)' : 'rgba(29,158,117,0.25)'}`,
                        }}
                      >
                        <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {t.requires}
                      </p>
                    )}

                    <p className="text-sm leading-relaxed mb-4" style={{ color: t.highlight ? 'rgba(255,255,255,0.8)' : INK_SOFT }}>{t.desc}</p>
                    <ul className="space-y-1.5 mb-4">
                      {t.points.map((p) => (
                        <li key={p} className="flex items-start gap-2 text-xs" style={{ color: t.highlight ? 'rgba(255,255,255,0.75)' : INK_SOFT }}>
                          <span className="mt-1 w-1 h-1 rounded-full flex-shrink-0" style={{ background: t.highlight ? 'rgba(255,255,255,0.6)' : BERRY }} />
                          {p}
                        </li>
                      ))}
                    </ul>

                    <p className="text-xs leading-relaxed mb-4 flex-1" style={{ color: t.highlight ? 'rgba(255,255,255,0.55)' : 'rgba(33,26,23,0.45)' }}>{t.bestFor}</p>

                    {'footnote' in t && t.footnote && (
                      <p
                        className="text-xs leading-relaxed rounded-lg px-3 py-2.5 mb-4"
                        style={{ background: t.highlight ? 'rgba(255,255,255,0.1)' : 'rgba(29,158,117,0.06)', color: t.highlight ? 'rgba(255,255,255,0.85)' : INK_SOFT }}
                      >
                        {t.footnote}
                      </p>
                    )}

                    <InquiryButton
                      defaultService={t.service}
                      className="block w-full text-center px-5 py-3 rounded-full text-sm font-bold transition-opacity hover:opacity-90"
                      style={t.highlight ? { background: '#fff', color: BERRY_DEEP } : { background: BERRY, color: '#fff' }}
                    >
                      {t.button}
                    </InquiryButton>
                  </div>
                ))}
              </div>

              {/* Upgrade credit */}
              <div
                className="mt-6 rounded-2xl px-6 py-5 flex items-start gap-3"
                style={{ background: '#fff', border: `1px dashed ${BERRY}` }}
              >
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: BERRY }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                <p className="text-sm leading-relaxed" style={{ color: INK_SOFT }}>
                  <span className="font-bold" style={{ color: INK }}>Start one-off, upgrade later.</span>{' '}
                  Begin with a Nutrition Plan or Blood Analysis + Plan, then upgrade to the Full Reset within 3 weeks and your one-off fee comes off the Reset price.
                </p>
              </div>

              {/* Add-ons */}
              <div className="mt-16 pt-16" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
                <p className="font-bold text-lg mb-2 text-center" style={{ fontFamily: HEAD }}>Add-ons</p>
                <p className="text-sm text-center mb-8" style={{ color: INK_SOFT }}>Available on any option, whenever you need them.</p>
                <div className="grid md:grid-cols-3 gap-5">
                  {COACHING_ADDONS.map((a) => (
                    <div key={a.title} className="rounded-2xl p-6" style={{ background: '#fff', border: '1px solid rgba(33,26,23,0.08)' }}>
                      <p className="font-bold text-base mb-1" style={{ fontFamily: HEAD }}>{a.title}</p>
                      <div className="flex items-baseline gap-2 mb-3 flex-wrap">
                        <span className="font-black" style={{ fontFamily: HEAD, fontSize: '1.5rem', color: INK }}>{a.price}</span>
                        <span className="text-xs" style={{ color: INK_SOFT }}>{a.priceNote}</span>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: INK_SOFT }}>{a.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Compare your options */}
              <div className="mt-16 pt-16" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
                <p className="font-bold text-lg mb-2 text-center" style={{ fontFamily: HEAD }}>Compare your options</p>
                <p className="text-sm text-center mb-8" style={{ color: INK_SOFT, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
                  Every option starts with your intake form, symptom analysis and 5-day food log. Here&apos;s how they differ from there.
                </p>
                <div className="-mx-6 px-6 overflow-x-auto">
                  <table className="w-full text-left" style={{ minWidth: 680, borderCollapse: 'separate', borderSpacing: 0 }}>
                    <thead>
                      <tr>
                        <th className="p-3" />
                        {COMPARE_COLUMNS.map((c) => (
                          <th
                            key={c}
                            className="p-3 text-xs font-bold align-bottom"
                            style={{ fontFamily: HEAD, color: c === 'The Full Reset' ? BERRY_DEEP : INK, width: '21%' }}
                          >
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {COMPARE_ROWS.map((row) => (
                        <tr key={row.label}>
                          <th
                            className="p-3 text-xs font-bold align-top"
                            style={{ fontFamily: HEAD, color: INK, borderTop: '1px solid rgba(33,26,23,0.08)', whiteSpace: 'nowrap' }}
                          >
                            {row.label}
                          </th>
                          {row.cells.map((cell, i) => (
                            <td
                              key={COMPARE_COLUMNS[i]}
                              className="p-3 text-xs align-top leading-relaxed"
                              style={{
                                color: cell === 'Not included' ? 'rgba(33,26,23,0.35)' : INK_SOFT,
                                borderTop: '1px solid rgba(33,26,23,0.08)',
                                background: COMPARE_COLUMNS[i] === 'The Full Reset' ? 'rgba(29,158,117,0.05)' : undefined,
                              }}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CTA */}
              <div className="text-center mt-16 pt-16" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
                <p className="text-sm mb-4" style={{ color: INK_SOFT, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
                  Every journey starts with a discovery call, where we work out the right level of support together based on your goals — not the other way around.
                </p>
                <InquiryButton defaultService="1:1 Nutrition Coaching" className="inline-block px-7 py-3.5 rounded-full text-sm font-bold text-white hover:opacity-90 transition-opacity" style={{ background: BERRY }}>
                  Book a discovery call
                </InquiryButton>
              </div>

              <p className="text-xs leading-relaxed mt-12 mx-auto text-center" style={{ color: 'rgba(33,26,23,0.4)', maxWidth: 620 }}>
                {COACHING_DISCLAIMER}
              </p>
            </div>
          ) : active === 'education' ? (
            <div>
              {/* Hero */}
              <div className="text-center" style={{ maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}>
                <h3 style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 'clamp(1.5rem,3.5vw,2.1rem)', lineHeight: 1.2, letterSpacing: '-0.02em', marginBottom: 16 }}>
                  It was never a willpower problem.
                </h3>
                <p style={{ color: INK_SOFT, fontWeight: 300 }}>
                  Most plans tell you what to eat. Almost none teach you why. The Prokol Method is 91 days of short video lessons that explain how your body actually works, one small habit at a time, all inside the Prokol app. One payment from $249. No subscription, no lock-in, and you keep every lesson and resource after you finish.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3 mt-7">
                  <InquiryButton
                    defaultService="The Prokol Method — Self-guided"
                    className="px-7 py-3.5 rounded-full text-sm font-bold text-white hover:opacity-90 transition-opacity"
                    style={{ background: BERRY }}
                  >
                    Start Week 0
                  </InquiryButton>
                  {BROCHURE_URL && (
                    <a
                      href={BROCHURE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-7 py-3.5 rounded-full text-sm font-bold transition-colors"
                      style={{ border: '1px solid rgba(33,26,23,0.15)', color: INK }}
                    >
                      Download the brochure
                    </a>
                  )}
                </div>
                <p className="text-xs mt-4" style={{ color: 'rgba(33,26,23,0.45)' }}>
                  About 35 minutes a week. Want my personal feedback? Add weekly replies.
                </p>
              </div>

              {/* Why nothing has stuck */}
              <div
                className="mt-16 mx-auto rounded-[2rem] px-8 py-8 md:px-12 md:py-9"
                style={{ background: 'rgba(29,158,117,0.08)', border: '1px solid rgba(29,158,117,0.18)', maxWidth: 700 }}
              >
                <p className="font-bold text-lg mb-3" style={{ fontFamily: HEAD }}>You were never taught how your body works</p>
                <p style={{ color: INK, fontWeight: 300, lineHeight: 1.65 }}>
                  So the moment life gets busy, you’re tired, or you’re starving at 3pm, the plan breaks and you’re back to guessing. Why do you crave sugar after a bad night’s sleep? Why do you hit a wall halfway through a session? Why are you hungrier at certain times of the month? Once you understand that, you stop relying on willpower. You know what to do, and why. That’s what makes it stick.
                </p>
              </div>

              {/* What you get */}
              <div className="mt-16 pt-16" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
                <p className="font-bold text-lg mb-8 text-center" style={{ fontFamily: HEAD }}>What you get</p>
                <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                  {WHATS_INCLUDED.map((item) => (
                    <div key={item.label} className="flex flex-col items-center text-center gap-2">
                      <span className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(29,158,117,0.1)', color: BERRY }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                        </svg>
                      </span>
                      <p className="font-bold text-sm" style={{ fontFamily: HEAD, color: INK }}>{item.label}</p>
                      <p className="text-xs leading-relaxed" style={{ color: INK_SOFT }}>{item.d}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Your 35 minutes a week */}
              <div className="mt-16 pt-16" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
                <p className="font-bold text-lg mb-2 text-center" style={{ fontFamily: HEAD }}>Every week: your 35 minutes</p>
                <p className="text-sm text-center mb-8" style={{ color: INK_SOFT }}>That’s the whole commitment. Here’s where it goes.</p>
                <div className="max-w-2xl mx-auto space-y-3">
                  {WEEKLY_RHYTHM.map((r) => (
                    <div key={r.when} className="rounded-xl p-4 flex items-start gap-4" style={{ background: '#fff', border: '1px solid rgba(33,26,23,0.08)' }}>
                      <span
                        className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full flex-shrink-0"
                        style={{ background: 'rgba(29,158,117,0.1)', color: BERRY, minWidth: 86, textAlign: 'center' }}
                      >
                        {r.when}
                      </span>
                      <p className="text-sm leading-relaxed" style={{ color: INK_SOFT }}>{r.what}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Your 91-day roadmap */}
              <div className="mt-16 pt-16" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
                <p className="font-bold text-lg mb-2 text-center" style={{ fontFamily: HEAD }}>Your 91-day roadmap</p>
                <p className="text-sm text-center mb-10" style={{ color: INK_SOFT, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
                  Not a quick fix. 91 days to understand your body, so your results last. Each topic builds on the last: keep the habit you’ve built, add one more.
                </p>

                <div className="max-w-3xl mx-auto space-y-10">
                  {ROADMAP.map((group, i) => (
                    <div key={group.month}>
                      <div className="flex items-baseline gap-3 mb-4">
                        <p className="font-bold text-sm" style={{ fontFamily: HEAD, color: INK }}>
                          Month {i + 1}: {group.month}
                        </p>
                        <span className="text-xs" style={{ color: 'rgba(33,26,23,0.4)' }}>{group.days}</span>
                        <span className="flex-1 h-px" style={{ background: 'rgba(33,26,23,0.1)' }} />
                      </div>
                      <div className="space-y-3">
                        {group.topics.map((t) => (
                          <div key={t.label} className="rounded-xl p-4 flex items-start gap-3" style={{ background: '#fff', border: '1px solid rgba(33,26,23,0.08)' }}>
                            <span
                              className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full flex-shrink-0"
                              style={{ background: 'rgba(29,158,117,0.1)', color: BERRY, minWidth: 66, textAlign: 'center' }}
                            >
                              {t.label}
                            </span>
                            <div>
                              <p className="font-bold text-sm" style={{ fontFamily: HEAD, color: INK }}>{t.title}</p>
                              <p className="text-xs italic mt-1" style={{ color: BERRY }}>{t.hook}</p>
                              <p className="text-xs leading-relaxed mt-1" style={{ color: INK_SOFT }}>{t.d}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-center mt-8">
                  <a
                    href={TOPIC_OVERVIEWS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-6 py-3 rounded-full text-sm font-bold transition-colors"
                    style={{ border: '1px solid rgba(33,26,23,0.15)', color: INK }}
                  >
                    Full topic overviews →
                  </a>
                </div>
              </div>

              {/* Watch every lesson */}
              <div className="mt-16 pt-16" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
                <div className="rounded-2xl px-7 py-6 max-w-2xl mx-auto" style={{ background: '#fff', borderLeft: `3px solid ${BERRY}` }}>
                  <p className="font-bold text-base mb-2" style={{ fontFamily: HEAD }}>My one ask: watch every lesson</p>
                  <p className="text-sm leading-relaxed" style={{ color: INK_SOFT }}>
                    The lessons are what change things. That’s where you learn the why. Skip them and it’s just another plan you don’t understand, waiting to stop working. When it gets busy, and it will, don’t stop. Do your minimum day, watch the lesson, and keep going.
                  </p>
                </div>
              </div>

              {/* FAQ */}
              <div className="max-w-3xl mx-auto mt-16 pt-16" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
                <p className="font-bold text-lg mb-4 text-center" style={{ fontFamily: HEAD }}>Questions</p>
                <div className="space-y-3">
                  {EDUCATION_FAQS.map((f) => (
                    <details key={f.q} className="group rounded-xl bg-white px-5 py-4" style={{ border: '1px solid rgba(33,26,23,0.08)' }}>
                      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden flex items-center justify-between gap-3 font-semibold text-sm" style={{ color: INK }}>
                        {f.q}
                        <svg className="w-4 h-4 flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <p className="text-sm leading-relaxed mt-3" style={{ color: INK_SOFT }}>{f.a}</p>
                    </details>
                  ))}
                </div>
              </div>

              {/* Pricing */}
              <div className="grid md:grid-cols-2 gap-5 mt-16 pt-16" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
                {EDUCATION_CARDS.map((t) => (
                  <div
                    key={t.title}
                    className="rounded-2xl p-7 flex flex-col"
                    style={t.highlight ? { background: BERRY_DEEP, color: '#fff' } : { background: '#fff', border: '1px solid rgba(33,26,23,0.08)' }}
                  >
                    <span
                      className="inline-block text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full mb-4"
                      style={t.highlight ? { background: 'rgba(255,255,255,0.15)', color: '#fff' } : { background: 'rgba(29,158,117,0.1)', color: BERRY }}
                    >
                      {t.tag}
                    </span>
                    <p className="font-bold text-lg" style={{ fontFamily: HEAD }}>{t.title}</p>
                    <p className="text-sm font-normal mb-4" style={{ color: t.highlight ? 'rgba(255,255,255,0.8)' : INK_SOFT }}>{t.subtitle}</p>

                    <div className="mb-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: t.highlight ? 'rgba(255,255,255,0.85)' : BERRY }}>
                        {t.priceLabel}
                      </p>
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-black" style={{ fontFamily: HEAD, fontSize: '2rem', lineHeight: 1, color: t.highlight ? '#fff' : INK }}>{t.price}</span>
                        <span className="text-xs" style={{ color: t.highlight ? 'rgba(255,255,255,0.75)' : INK_SOFT }}>{t.priceNote}</span>
                      </div>
                      <p className="text-xs mt-1.5" style={{ color: t.highlight ? 'rgba(255,255,255,0.55)' : 'rgba(33,26,23,0.4)' }}>{t.priceWeekly}</p>
                    </div>

                    <p className="text-sm leading-relaxed mb-4" style={{ color: t.highlight ? 'rgba(255,255,255,0.8)' : INK_SOFT }}>{t.desc}</p>
                    <ul className="space-y-1.5 mb-5 flex-1">
                      {t.points.map((p) => (
                        <li key={p} className="flex items-start gap-2 text-xs" style={{ color: t.highlight ? 'rgba(255,255,255,0.75)' : INK_SOFT }}>
                          <span className="mt-1 w-1 h-1 rounded-full flex-shrink-0" style={{ background: t.highlight ? 'rgba(255,255,255,0.6)' : BERRY }} />
                          {p}
                        </li>
                      ))}
                    </ul>
                    <InquiryButton
                      defaultService={t.service}
                      className="block w-full text-center px-5 py-3 rounded-full text-sm font-bold transition-opacity hover:opacity-90"
                      style={t.highlight ? { background: '#fff', color: BERRY_DEEP } : { background: BERRY, color: '#fff' }}
                    >
                      {t.button}
                    </InquiryButton>
                  </div>
                ))}
              </div>

              {/* Closing banner */}
              <div className="rounded-[2rem] px-8 py-12 mt-16 text-center" style={{ background: BERRY_DEEP }}>
                <h3 style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 'clamp(1.5rem,3.5vw,2.1rem)', color: '#fff', marginBottom: 10 }}>
                  Stop starting over.
                </h3>
                <p className="mb-8" style={{ color: 'rgba(255,255,255,0.78)', fontWeight: 300 }}>
                  Learn how your body works, once, properly.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <InquiryButton
                    defaultService="The Prokol Method — Self-guided"
                    className="px-7 py-3.5 rounded-full text-sm font-bold transition-opacity hover:opacity-90"
                    style={{ background: '#fff', color: BERRY_DEEP }}
                  >
                    Start Week 0
                  </InquiryButton>
                  {BROCHURE_URL && (
                    <a
                      href={BROCHURE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-7 py-3.5 rounded-full text-sm font-bold transition-colors"
                      style={{ border: '1px solid rgba(255,255,255,0.35)', color: '#fff' }}
                    >
                      Download the brochure
                    </a>
                  )}
                </div>
              </div>

              <p className="text-xs text-center mt-8" style={{ color: 'rgba(33,26,23,0.4)' }}>
                The Prokol Method is for education only, not medical advice — check with your GP for anything medical. Want support built entirely around you instead?{' '}
                <button type="button" onClick={() => setActive('coaching')} className="font-semibold underline" style={{ color: BERRY }}>
                  Explore 1:1 coaching
                </button>
              </p>
            </div>
          ) : active === 'gyms' ? (
            <div>
              {/* G1. Hero */}
              <div className="text-center" style={{ maxWidth: 660, marginLeft: 'auto', marginRight: 'auto' }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: BERRY }}>For gym owners</p>
                <h3 style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 'clamp(1.5rem,3.5vw,2.1rem)', lineHeight: 1.2, letterSpacing: '-0.02em', marginBottom: 16 }}>
                  When members stop feeling the benefit, they leave.
                </h3>
                <p style={{ color: INK_SOFT, fontWeight: 300 }}>
                  It’s not your training. Results are mostly made in the 23 hours they’re not in your gym. The Prokol Method gives every member a nutritionist on hand, all year, inside your gym’s own branded app. One flat monthly fee, no extra cost to members.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3 mt-7">
                  <InquiryButton
                    defaultService="Gym & Studio Partnerships"
                    className="px-7 py-3.5 rounded-full text-sm font-bold text-white hover:opacity-90 transition-opacity"
                    style={{ background: BERRY }}
                  >
                    Book a call
                  </InquiryButton>
                  {GYM_BROCHURE_URL && (
                    <a
                      href={GYM_BROCHURE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-7 py-3.5 rounded-full text-sm font-bold transition-colors"
                      style={{ border: '1px solid rgba(33,26,23,0.15)', color: INK }}
                    >
                      Download the gym brochure
                    </a>
                  )}
                </div>
              </div>

              {/* G2. Sound familiar? */}
              <div className="mt-16 pt-16" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
                <p className="font-bold text-lg mb-2 text-center" style={{ fontFamily: HEAD }}>Sound familiar?</p>
                <p className="text-sm text-center mb-8" style={{ color: INK_SOFT }}>You’re not doing anything wrong. You’re just fixing the wrong thing.</p>
                <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto">
                  {GYM_PROBLEM.map((c) => (
                    <div
                      key={c.t}
                      className="rounded-2xl p-6"
                      style={'highlight' in c && c.highlight
                        ? { background: BERRY_DEEP, color: '#fff' }
                        : { background: '#fff', border: '1px solid rgba(33,26,23,0.08)' }}
                    >
                      <p className="font-bold text-sm mb-2" style={{ fontFamily: HEAD, color: 'highlight' in c && c.highlight ? '#fff' : INK }}>{c.t}</p>
                      <p className="text-xs leading-relaxed" style={{ color: 'highlight' in c && c.highlight ? 'rgba(255,255,255,0.8)' : INK_SOFT }}>{c.d}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* G3. The fix */}
              <div className="mt-16 pt-16" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
                <div className="text-center mb-8" style={{ maxWidth: 660, marginLeft: 'auto', marginRight: 'auto' }}>
                  <p className="font-bold text-lg mb-3" style={{ fontFamily: HEAD }}>It was never a willpower problem</p>
                  <p className="text-sm leading-relaxed" style={{ color: INK_SOFT }}>
                    Most members were never taught how their body works. So the moment life gets busy, they’re tired or they’re starving at 3pm, the plan breaks and they’re back to guessing. Once they understand the why, they stop relying on willpower. They know what to do, and why. That’s what makes it stick.
                  </p>
                </div>
                <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto">
                  {GYM_FIX_CARDS.map((c) => (
                    <div key={c.t} className="rounded-2xl p-6" style={{ background: 'rgba(29,158,117,0.08)', border: '1px solid rgba(29,158,117,0.18)' }}>
                      <p className="font-bold text-sm mb-2" style={{ fontFamily: HEAD, color: INK }}>{c.t}</p>
                      <p className="text-xs leading-relaxed" style={{ color: INK_SOFT }}>{c.d}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* G4. What every member gets */}
              <div className="mt-16 pt-16" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
                <p className="font-bold text-lg mb-6 text-center" style={{ fontFamily: HEAD }}>What every member gets</p>

                <div
                  className="text-center mx-auto rounded-[2rem] px-8 py-8 md:px-12 md:py-9"
                  style={{ background: 'rgba(29,158,117,0.08)', border: '1px solid rgba(29,158,117,0.18)', maxWidth: 700 }}
                >
                  <p style={{ color: INK, fontWeight: 300, fontSize: '1.05rem', lineHeight: 1.6 }}>
                    A nutritionist on hand for every member, all year, inside your gym’s own branded app. Their plan, their macros and someone to ask, for as long as they’re a member. Plus 25 short video lessons and 24 guides that teach them the why, one small habit at a time. One flat monthly fee covers everyone, every flag is seen, and it takes zero extra time from your trainers.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-10 max-w-2xl mx-auto">
                  {GYM_STATS.map((s) => (
                    <div key={s.label} className="rounded-2xl text-center py-7 px-3" style={{ background: '#fff', border: '1px solid rgba(33,26,23,0.08)' }}>
                      <p className="font-black" style={{ fontFamily: HEAD, fontSize: '2.25rem', lineHeight: 1, color: BERRY }}>{s.n}</p>
                      <p className="text-sm mt-2" style={{ color: INK_SOFT }}>{s.label}</p>
                    </div>
                  ))}
                </div>

                <div className="grid md:grid-cols-2 gap-3 mt-10 max-w-3xl mx-auto">
                  {GYM_MEMBER_FEATURES.map((f) => (
                    <div key={f.t} className="rounded-xl p-4" style={{ background: '#fff', border: '1px solid rgba(33,26,23,0.08)' }}>
                      <p className="font-bold text-sm" style={{ fontFamily: HEAD, color: INK }}>{f.t}</p>
                      <p className="text-xs leading-relaxed mt-0.5" style={{ color: INK_SOFT }}>{f.d}</p>
                    </div>
                  ))}
                </div>

                <div className="text-center mt-8">
                  <a
                    href={TOPIC_OVERVIEWS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-6 py-3 rounded-full text-sm font-bold transition-colors"
                    style={{ border: '1px solid rgba(33,26,23,0.15)', color: INK }}
                  >
                    Full topic overviews →
                  </a>
                </div>
              </div>

              {/* G5. What your gym gets */}
              <div className="mt-16 pt-16" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
                <p className="font-bold text-lg mb-8 text-center" style={{ fontFamily: HEAD }}>What your gym gets</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {GYM_WHATS_INCLUDED.map((item) => (
                    <div key={item.label} className="flex flex-col items-center text-center gap-2">
                      <span className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(29,158,117,0.1)', color: BERRY }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.d} />
                        </svg>
                      </span>
                      <p className="text-xs leading-relaxed" style={{ color: INK_SOFT }}>{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* G6. Safety flags */}
              <div className="mt-16 pt-16" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
                <p className="font-bold text-lg mb-2 text-center" style={{ fontFamily: HEAD }}>41 built-in flags across the progress reviews</p>
                <p className="text-sm text-center mb-8" style={{ color: INK_SOFT, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
                  Every progress check is screened against 41 built-in flags, so nothing slips through. I see every one.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-5 max-w-3xl mx-auto">
                  {GYM_FLAG_CATEGORIES.map((c) => (
                    <div key={c.n} className="rounded-xl p-4" style={{ background: '#fff', border: '1px solid rgba(33,26,23,0.08)' }}>
                      <p className="font-bold text-sm mb-1" style={{ fontFamily: HEAD, color: INK }}>{c.t}</p>
                      <p className="text-xs leading-relaxed" style={{ color: INK_SOFT }}>{c.d}</p>
                    </div>
                  ))}
                </div>

                <div className="grid md:grid-cols-3 gap-5 mt-8 max-w-3xl mx-auto">
                  {GYM_FLAG_HANDLING.map((h) => (
                    <div key={h.t}>
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: BERRY }}>{h.t}</p>
                      <p className="text-xs leading-relaxed" style={{ color: INK_SOFT }}>{h.d}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* G7. How it works */}
              <div className="mt-16 pt-16" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
                <p className="font-bold text-lg mb-8 text-center" style={{ fontFamily: HEAD }}>How it works</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {GYM_HOW_IT_WORKS.map((step) => (
                    <div key={step.n}>
                      <p className="text-xs font-bold tracking-widest mb-2" style={{ color: BERRY }}>{step.n}</p>
                      <p className="font-bold mb-2" style={{ fontFamily: HEAD }}>{step.t}</p>
                      <p className="text-sm leading-relaxed" style={{ color: INK_SOFT }}>{step.d}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* G8. Pricing */}
              <div className="mt-16 pt-16" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
                <p className="font-bold text-lg mb-2 text-center" style={{ fontFamily: HEAD }}>One set price for your gym</p>
                <p className="text-sm text-center mb-8" style={{ color: INK_SOFT, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
                  Every member included. Then add Personal Replies if you want me answering every member myself.
                </p>

                <div className="grid md:grid-cols-2 gap-5">
                  {GYM_TIERS.map((t) => (
                    <div
                      key={t.title}
                      className="rounded-2xl p-7 flex flex-col"
                      style={t.highlight ? { background: BERRY_DEEP, color: '#fff' } : { background: '#fff', border: '1px solid rgba(33,26,23,0.08)' }}
                    >
                      <span
                        className="inline-block text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full mb-4 self-start"
                        style={t.highlight ? { background: 'rgba(255,255,255,0.15)', color: '#fff' } : { background: 'rgba(29,158,117,0.1)', color: BERRY }}
                      >
                        {t.tag}
                      </span>
                      <p className="font-bold text-lg" style={{ fontFamily: HEAD }}>{t.title}</p>
                      <p className="text-sm font-normal mb-4" style={{ color: t.highlight ? 'rgba(255,255,255,0.8)' : INK_SOFT }}>{t.subtitle}</p>

                      <div className="mb-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: t.highlight ? 'rgba(255,255,255,0.85)' : BERRY }}>
                          {t.priceLabel}
                        </p>
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-black" style={{ fontFamily: HEAD, fontSize: '2rem', lineHeight: 1, color: t.highlight ? '#fff' : INK }}>{t.price}</span>
                          <span className="text-xs" style={{ color: t.highlight ? 'rgba(255,255,255,0.75)' : INK_SOFT }}>{t.priceNote}</span>
                        </div>
                        <p className="text-xs mt-1.5" style={{ color: t.highlight ? 'rgba(255,255,255,0.55)' : 'rgba(33,26,23,0.4)' }}>{t.priceWeekly}</p>
                      </div>

                      <p className="text-sm leading-relaxed mb-4" style={{ color: t.highlight ? 'rgba(255,255,255,0.8)' : INK_SOFT }}>{t.desc}</p>
                      <ul className="space-y-1.5 mb-5 flex-1">
                        {t.points.map((p) => (
                          <li key={p} className="flex items-start gap-2 text-xs" style={{ color: t.highlight ? 'rgba(255,255,255,0.75)' : INK_SOFT }}>
                            <span className="mt-1 w-1 h-1 rounded-full flex-shrink-0" style={{ background: t.highlight ? 'rgba(255,255,255,0.6)' : BERRY }} />
                            {p}
                          </li>
                        ))}
                      </ul>
                      <InquiryButton
                        defaultService={t.service}
                        className="block w-full text-center px-5 py-3 rounded-full text-sm font-bold transition-opacity hover:opacity-90"
                        style={t.highlight ? { background: '#fff', color: BERRY_DEEP } : { background: BERRY, color: '#fff' }}
                      >
                        {t.button}
                      </InquiryButton>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-center mt-5" style={{ color: 'rgba(33,26,23,0.45)' }}>
                  One-off onboarding, then monthly from day one with 30 days’ notice. Over 150 members: +$2 each (+$4 with Personal Replies). AUD ex GST.
                </p>
              </div>

              {/* Member add-ons */}
              <div className="mt-16 pt-16" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
                <p className="font-bold text-lg mb-2 text-center" style={{ fontFamily: HEAD }}>Member add-ons</p>
                <p className="text-sm text-center mb-8" style={{ color: INK_SOFT }}>Optional extras on top, for members who want more.</p>
                <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto">
                  {GYM_ADDONS.map((a) => (
                    <div key={a.title} className="rounded-2xl p-6" style={{ background: '#fff', border: '1px solid rgba(33,26,23,0.08)' }}>
                      <p className="font-bold text-base mb-1" style={{ fontFamily: HEAD }}>{a.title}</p>
                      <div className="flex items-baseline gap-2 mb-3 flex-wrap">
                        <span className="font-black" style={{ fontFamily: HEAD, fontSize: '1.5rem', color: INK }}>{a.price}</span>
                        <span className="text-xs" style={{ color: INK_SOFT }}>{a.priceNote}</span>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: INK_SOFT }}>{a.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* G9. FAQ */}
              <div className="max-w-3xl mx-auto mt-16 pt-16" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
                <p className="font-bold text-lg mb-4 text-center" style={{ fontFamily: HEAD }}>Questions</p>
                <div className="space-y-3">
                  {GYM_FAQS.map((f) => (
                    <details key={f.q} className="group rounded-xl bg-white px-5 py-4" style={{ border: '1px solid rgba(33,26,23,0.08)' }}>
                      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden flex items-center justify-between gap-3 font-semibold text-sm" style={{ color: INK }}>
                        {f.q}
                        <svg className="w-4 h-4 flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <p className="text-sm leading-relaxed mt-3" style={{ color: INK_SOFT }}>{f.a}</p>
                    </details>
                  ))}
                </div>
              </div>

              {/* G10. Closing banner */}
              <div className="rounded-[2rem] px-8 py-12 mt-16 text-center" style={{ background: BERRY_DEEP }}>
                <h3 style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 'clamp(1.5rem,3.5vw,2.1rem)', color: '#fff', marginBottom: 10 }}>
                  Stop chasing sign-ups just to stand still.
                </h3>
                <p className="mb-8" style={{ color: 'rgba(255,255,255,0.78)', fontWeight: 300 }}>
                  Give every member a nutritionist, and a reason to stay.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <InquiryButton
                    defaultService="Gym & Studio Partnerships"
                    className="px-7 py-3.5 rounded-full text-sm font-bold transition-opacity hover:opacity-90"
                    style={{ background: '#fff', color: BERRY_DEEP }}
                  >
                    Book a call
                  </InquiryButton>
                  {GYM_BROCHURE_URL && (
                    <a
                      href={GYM_BROCHURE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-7 py-3.5 rounded-full text-sm font-bold transition-colors"
                      style={{ border: '1px solid rgba(255,255,255,0.35)', color: '#fff' }}
                    >
                      Download the gym brochure
                    </a>
                  )}
                </div>
              </div>

              <p className="text-xs text-center mt-8" style={{ color: 'rgba(33,26,23,0.4)' }}>
                Education only, not medical advice. Anything medical goes to a GP.
              </p>
            </div>
          ) : (
            <div>
              <div className="rounded-2xl p-8 bg-white max-w-3xl mx-auto" style={{ border: '1px solid rgba(33,26,23,0.08)' }}>
                <div className="flex items-start gap-5">
                  <span className="text-3xl flex-shrink-0">{SIMPLE_PANELS[active as Exclude<ServiceKey, 'coaching' | 'education' | 'gyms'>].icon}</span>
                  <div>
                    <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                      <p className="font-bold text-xl" style={{ fontFamily: HEAD }}>{activeLabel}</p>
                      {SIMPLE_PANELS[active as Exclude<ServiceKey, 'coaching' | 'education' | 'gyms'>].badge && (
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full" style={{ background: 'rgba(29,158,117,0.1)', color: 'var(--nc-primary)' }}>
                          {SIMPLE_PANELS[active as Exclude<ServiceKey, 'coaching' | 'education' | 'gyms'>].badge}
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: INK_SOFT }}>{SIMPLE_PANELS[active as Exclude<ServiceKey, 'coaching' | 'education' | 'gyms'>].desc}</p>
                  </div>
                </div>
              </div>

              <div className="text-center mt-12">
                <InquiryButton defaultService={activeLabel} className="inline-block px-7 py-3.5 rounded-full text-sm font-bold text-white hover:opacity-90 transition-opacity" style={{ background: BERRY }}>
                  Get in touch
                </InquiryButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
