/**
 * Seed fixtures for Volt V.
 *
 * Every franchise, studio and person below is invented. That is deliberate:
 * a demo database full of fabricated reporting about real films, shows and
 * real people would be indistinguishable from fake news the moment anyone
 * screenshotted it. The fictional universe reads just as realistically.
 */

export const CATEGORIES = [
  { name: 'Movies', slug: 'movies', colour: '#00E88F', order: 1, description: 'Everything on the big screen: releases, reporting, reviews and rankings.' },
  { name: 'TV', slug: 'tv', colour: '#FF6B4A', order: 2, description: 'Scripted television, streaming drama and everything in the schedule.' },
  { name: 'Reality TV', slug: 'reality-tv', colour: '#F25CA2', order: 3, description: 'Competition, dating, renovation and the unscripted end of the dial.' },
  { name: 'Comics', slug: 'comics', colour: '#9B7BFF', order: 4, description: 'Single issues, trades, floppies and the publishers behind them.' },
  { name: 'Gaming', slug: 'gaming', colour: '#F43F5E', order: 5, description: 'Console, PC and handheld — news, verdicts and long reads.' },
  { name: 'Anime', slug: 'anime', colour: '#5CE1A6', order: 6, description: 'Seasonal simulcasts, manga adaptations and studio reporting.' },
  { name: 'Videos', slug: 'videos', colour: '#7CE8B8', order: 7, description: 'Interviews, podcasts and video features from the Volt V team.' },
];

export const CONTENT_TYPES = [
  { name: 'News', slug: 'news', order: 1 },
  { name: 'Feature', slug: 'features', order: 2 },
  { name: 'Review', slug: 'reviews', order: 3 },
  { name: 'List', slug: 'lists', order: 4 },
  { name: 'Interview', slug: 'interviews', order: 5 },
  { name: 'Trailer', slug: 'trailers', order: 6 },
  { name: 'Opinion', slug: 'opinion', order: 7 },
];

/** Which formats each vertical actually publishes — drives the mega-menu. */
export const CATEGORY_FORMATS: Record<string, string[]> = {
  movies: ['news', 'features', 'reviews', 'lists', 'trailers', 'opinion'],
  tv: ['news', 'features', 'reviews', 'lists', 'opinion'],
  'reality-tv': ['news', 'features', 'lists'],
  comics: ['news', 'features', 'reviews', 'lists'],
  gaming: ['news', 'features', 'reviews', 'lists', 'trailers'],
  anime: ['news', 'features', 'reviews', 'lists'],
  videos: ['lists', 'interviews', 'features'],
};

export const AUTHORS = [
  { name: 'Mara Delacroix', role: 'ADMIN', beat: 'movies', bio: 'Editor-in-chief at Volt V. Fifteen years covering the film business, still loses arguments about the third act.' },
  { name: 'Idris Vane', role: 'EDITOR', beat: 'tv', bio: 'TV editor. Watches the pilot twice so you do not have to.' },
  { name: 'Noor Haddad', role: 'EDITOR', beat: 'gaming', bio: 'Games editor. Has opinions about inventory menus and will share them.' },
  { name: 'Theo Marchetti', role: 'AUTHOR', beat: 'movies', bio: 'Senior features writer covering blockbusters, budgets and the people who greenlight them.' },
  { name: 'Priya Raghunathan', role: 'AUTHOR', beat: 'anime', bio: 'Anime and manga writer. Reads the source material before the adaptation lands.' },
  { name: 'Jonah Feld', role: 'AUTHOR', beat: 'comics', bio: 'Comics writer. Long boxes in the garage, spreadsheet of every crossover since 1998.' },
  { name: 'Selma Okonkwo', role: 'AUTHOR', beat: 'tv', bio: 'Writes about prestige drama, streaming strategy and the shows nobody renewed.' },
  { name: 'Rafael Duarte', role: 'AUTHOR', beat: 'gaming', bio: 'Reviews games on hardware you can actually afford. Timers everything.' },
  { name: 'Cassie Lindqvist', role: 'AUTHOR', beat: 'reality-tv', bio: 'Reality TV correspondent. Knows every edit trick in the genre and names them.' },
  { name: 'Dev Anand Pillai', role: 'AUTHOR', beat: 'movies', bio: 'Box office analyst. Turns weekend grosses into arguments about what audiences want.' },
  { name: 'Hanne Bruun', role: 'AUTHOR', beat: 'anime', bio: 'Covers studios, schedules and the animators who never make the credits roll.' },
  { name: 'Malik Osei', role: 'AUTHOR', beat: 'comics', bio: 'Interviews artists and letterers. Believes the letterer is the unsung half of the page.' },
  { name: 'Ivy Castellanos', role: 'AUTHOR', beat: 'videos', bio: 'Video producer and host of the Volt V interview series.' },
  { name: 'Bram Nowak', role: 'AUTHOR', beat: 'tv', bio: 'Recaps, schedules and the week-to-week grind of network television.' },
  { name: 'Yuki Sorensen', role: 'AUTHOR', beat: 'gaming', bio: 'Handheld and indie games. Plays the tutorial with the sound on.' },
] as const;

/** Invented properties, one pool per vertical. */
export const FRANCHISES: Record<string, string[]> = {
  movies: ['Aetherfall', 'The Kestrel Protocol', 'Ironhollow', 'Nightmarket', 'Solaris Divide', 'Cobalt Saints', 'The Long Autumn', 'Vantablack', 'Salt & Ember', 'The Ninth Harbour'],
  tv: ['Harbourline', 'Ashgrove', 'The Quiet Fleet', 'Meridian Bay', 'Stonefall', 'Nine Lanterns', 'Paper Kingdom', 'Low Tide', 'The Understudy'],
  'reality-tv': ['Last House Standing', 'The Glass Kitchen', 'Iron Harvest Farm', 'Bidding War', 'Concrete Dreams', 'Second Service'],
  comics: ['Red Meridian', 'The Ossuary', 'Halcyon Six', 'Grave Tide', 'Vantablack', 'Saint Machine', 'Paper Kingdom'],
  gaming: ['Orbital Drift', 'Silt & Bone', 'Neon Dynasty', 'Ravenmarch', 'Deepfield', 'Tesselate', 'Hollow Signal', 'Ashen Cradle'],
  anime: ['Blade of the Falling Sky', 'Ashen Cradle', 'Hollow Signal', 'Petalstorm', 'The Cartographer of Salt', 'Iron Lullaby'],
  videos: ['Aetherfall', 'Neon Dynasty', 'Harbourline', 'Red Meridian', 'Blade of the Falling Sky'],
};

export const STUDIOS = ['Kestrel Pictures', 'Northlight Studios', 'Vireo+', 'Ardent TV', 'Halcyon Interactive', 'Studio Kagami', 'Bellwether Films', 'Marrow House Comics', 'Tidewater Animation'];

export const PEOPLE = ['Nina Barlowe', 'Osric Wren', 'Camille Ayotte', 'Deshaun Pryce', 'Lotte Vandermeer', 'Emeka Balogun', 'Sana Qureshi', 'Tomas Rieber', 'Juno Farrow', 'Kwame Adjei', 'Beatriz Salas', 'Henrik Ohlsson', 'Aisling Byrne', 'Reza Farahani', 'Mei-Ling Chou'];

export const ROLES_IN_CREDIT = ['director', 'showrunner', 'lead writer', 'creative director', 'series producer', 'game director', 'series composer'];

export const TAG_POOL = [
  'Aetherfall', 'Harbourline', 'Neon Dynasty', 'Red Meridian', 'Orbital Drift', 'Kestrel Pictures', 'Northlight Studios', 'Vireo+', 'Halcyon Interactive', 'Studio Kagami',
  'Box Office', 'Casting', 'Release Dates', 'Streaming', 'Sequels', 'Reboots', 'Season 2', 'Season 3', 'Finale', 'Renewal', 'Cancellation',
  'Trailers', 'Interviews', 'Behind The Scenes', 'VFX', 'Soundtrack', 'Screenwriting', 'Cinematography',
  'Console Exclusives', 'Handheld', 'Indie Games', 'Patch Notes', 'DLC', 'Speedrunning', 'Game Awards',
  'Manga', 'Simulcast', 'Studio News', 'Voice Cast', 'Localisation',
  'Single Issues', 'Trade Paperbacks', 'Variant Covers', 'Crossovers', 'Letterers',
  'Reality Competition', 'Elimination', 'Reunion Special', 'Casting Controversy',
  'Awards Season', 'Festival Circuit', 'Ratings', 'Streaming Numbers',
];

// ------------------------------------------------------------ headline kits

type HeadlineKit = {
  contentType: string;
  templates: string[];
  weight: number;
};

export const HEADLINE_KITS: HeadlineKit[] = [
  {
    contentType: 'news',
    weight: 34,
    templates: [
      '{franchise} {ordinal} {unit} Sets {month} {year} Release Date',
      '{studio} Confirms {franchise} {unit} Is Officially In Production',
      '{person} Joins {franchise} {unit} In An Undisclosed Role',
      '{franchise} {unit} Has Reportedly Finished Filming After {n} Months',
      '{studio} Delays {franchise} To {month} {year}, Blames Post-Production Schedule',
      '{franchise} Passes {bignum} In Its Opening Weekend, Beating Every Projection',
      '{person} Says The {franchise} {unit} Script Is "Nearly Unrecognisable" From The First Draft',
      '{franchise} {unit} Adds {n} New Cast Members Ahead Of Its {month} Shoot',
      '{studio} Quietly Removes {franchise} From Its {year} Slate',
      '{franchise} Renewed For {ordinal} {unit} Before The Premiere Even Airs',
    ],
  },
  {
    contentType: 'features',
    weight: 20,
    templates: [
      '{franchise} Has A {element} Problem, And It Started Long Before The {unit}',
      'The Quiet Genius Of {franchise}’s {element}, Explained',
      'How {studio} Turned {franchise} Into Its Most Reliable Asset',
      'Nobody Is Talking About The Best Thing In {franchise}: Its {element}',
      '{franchise} Ended {n} Years Ago. Its {element} Is Still Everywhere.',
      'The Case For Letting {franchise} Finish On Its Own Terms',
      'Inside The {n}-Month Rewrite That Saved {franchise}',
      'Why {franchise}’s {element} Divides Its Audience So Cleanly',
    ],
  },
  {
    contentType: 'reviews',
    weight: 14,
    templates: [
      '{franchise} Review: {verdict}',
      '{franchise} {ordinal} {unit} Review: {verdict}',
      '{franchise} Review — {verdict}',
    ],
  },
  {
    contentType: 'lists',
    weight: 18,
    templates: [
      '{n} {franchise} Details That Only Make Sense On A Rewatch',
      '{n} Things {franchise} Does Better Than Anything Else This Year',
      'Every {franchise} {unit}, Ranked From Worst To Best',
      '{n} Unanswered Questions After The {franchise} Finale',
      '{n} {franchise} Moments That Deserved More Screen Time',
      'The {n} Best {category} Releases Of {year} So Far',
      '{n} Small {franchise} Changes That Fixed Its Biggest Problem',
    ],
  },
  {
    contentType: 'interviews',
    weight: 5,
    templates: [
      '{person} On {franchise}, {element} And Knowing When To Stop',
      '{person} Breaks Down The {franchise} {element} Everyone Argued About',
      '{person}: "We Rewrote The {franchise} Ending {n} Times"',
    ],
  },
  {
    contentType: 'trailers',
    weight: 5,
    templates: [
      '{franchise} Trailer Breakdown: {n} Details You Missed',
      'The New {franchise} Trailer Quietly Confirms {element} Is Back',
      '{franchise} Teaser Reveals Its {month} {year} Setting',
    ],
  },
  {
    contentType: 'opinion',
    weight: 4,
    templates: [
      '{franchise} Does Not Need Another {unit}, And Everyone Knows It',
      'Stop Asking {franchise} To Be Something It Never Was',
      'The {franchise} Discourse Has Stopped Being About {franchise}',
    ],
  },
];

export const ELEMENTS = ['second act', 'ensemble cast', 'sound design', 'production design', 'colour grade', 'score', 'pacing', 'world-building', 'villain', 'ending', 'editing', 'dialogue', 'lore', 'combat system', 'art direction'];

export const VERDICTS = [
  'A Confident, Unhurried Return To Form',
  'Gorgeous, Overlong And Almost Great',
  'The Best Thing Its Studio Has Made In A Decade',
  'A Middle Chapter That Forgets To Have A Middle',
  'Technically Astonishing, Emotionally Weightless',
  'Small, Strange And Completely Sure Of Itself',
  'A Sequel That Justifies Itself In Its Final Twenty Minutes',
  'Ambitious Enough To Survive Its Own Mistakes',
  'The Rare Follow-Up That Improves On The Original',
  'Beautiful To Look At, Exhausting To Sit Through',
];

export const UNITS = ['Sequel', 'Season', 'Chapter', 'Instalment', 'Expansion', 'Arc', 'Film', 'Series'];
export const ORDINALS = ['Second', 'Third', 'Fourth', 'Fifth', 'Final'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// ------------------------------------------------------------ body prose

export const OPENERS = [
  '{franchise} has spent the last {n} years being defined by everything except its own storytelling, and the {unit} finally does something about that.',
  'There is a moment about forty minutes into the new {franchise} {unit} where the whole thing clicks into place.',
  '{studio} has never been shy about what {franchise} is for, which makes the last {n} weeks of reporting all the more surprising.',
  'For a property that started as a footnote on {studio}’s slate, {franchise} has become remarkably hard to ignore.',
  'The most interesting thing about {franchise} right now has nothing to do with what happens on screen.',
  'Ask {n} people what {franchise} is actually about and you will get {n} answers, which is either a strength or the whole problem.',
];

export const BODY_SENTENCES = [
  'The {element} does most of the heavy lifting here, and it does it without ever drawing attention to itself.',
  '{person} plays the role as someone permanently two seconds away from saying the thing they should have said years ago.',
  '{studio} has been careful not to confirm any of this on the record, which is usually a sign that the deal is not closed.',
  'That decision looks small in isolation and enormous once you see what it sets up in the back half.',
  'It is the kind of choice that only works if the audience trusts the people making it, and by this point they have earned that.',
  'The pacing sags in the middle stretch, where three separate subplots take turns explaining themselves.',
  'Compare it to the {ordinal} {unit} and the difference in confidence is obvious from the first scene.',
  'Nothing about the marketing prepared anyone for how quiet the ending actually is.',
  'Sources close to production describe a rewrite process that ran well into the shoot.',
  'The {element} has divided viewers since the first episode, and the {unit} does nothing to settle the argument.',
  'What makes it work is restraint: the story keeps declining the obvious version of itself.',
  '{person} and {person2} share only two scenes, and both of them are the best in the {unit}.',
  'On a second viewing the structure reveals itself as far more deliberate than it first appears.',
  'The budget is visible in every frame, which is not always a compliment.',
  'It arrives at a moment when audiences have been asked to care about roughly six of these a year.',
  'The result is uneven, occasionally brilliant, and never boring.',
  'Whether that lands depends entirely on how much patience you brought with you.',
  'By the time the credits roll, the {element} has quietly become the most memorable thing in it.',
];

export const CLOSERS = [
  '{franchise} returns in {month} {year}. On this evidence, it has earned the wait.',
  'Whatever comes next, {studio} now has a version of {franchise} worth protecting.',
  'The {unit} is available now. The argument about it will run considerably longer.',
  'It is not the {franchise} anyone expected. It might be the one it needed.',
];

export const PULL_QUOTES = [
  'We rewrote the ending until it stopped being clever and started being true.',
  'Nobody at the studio asked for a quieter version. We just made one.',
  'If the audience notices the {element}, we have already failed.',
  'The hardest part was convincing everyone that less was the ambitious option.',
];

// ------------------------------------------------------------ analytics mix

/** Traffic geography: share, country code/name, and plausible city split. */
export const GEO: {
  code: string;
  country: string;
  share: number;
  cities: { city: string; region: string; lat: number; lon: number; weight: number }[];
}[] = [
  { code: 'US', country: 'United States', share: 0.325, cities: [
    { city: 'New York', region: 'New York', lat: 40.71, lon: -74.01, weight: 0.18 },
    { city: 'Los Angeles', region: 'California', lat: 34.05, lon: -118.24, weight: 0.15 },
    { city: 'Chicago', region: 'Illinois', lat: 41.88, lon: -87.63, weight: 0.1 },
    { city: 'Houston', region: 'Texas', lat: 29.76, lon: -95.37, weight: 0.09 },
    { city: 'Atlanta', region: 'Georgia', lat: 33.75, lon: -84.39, weight: 0.08 },
    { city: 'Seattle', region: 'Washington', lat: 47.61, lon: -122.33, weight: 0.08 },
    { city: 'Denver', region: 'Colorado', lat: 39.74, lon: -104.99, weight: 0.06 },
    { city: 'Miami', region: 'Florida', lat: 25.76, lon: -80.19, weight: 0.07 },
    { city: 'Phoenix', region: 'Arizona', lat: 33.45, lon: -112.07, weight: 0.06 },
    { city: 'Boston', region: 'Massachusetts', lat: 42.36, lon: -71.06, weight: 0.13 },
  ] },
  { code: 'GB', country: 'United Kingdom', share: 0.098, cities: [
    { city: 'London', region: 'England', lat: 51.51, lon: -0.13, weight: 0.5 },
    { city: 'Manchester', region: 'England', lat: 53.48, lon: -2.24, weight: 0.16 },
    { city: 'Birmingham', region: 'England', lat: 52.49, lon: -1.89, weight: 0.12 },
    { city: 'Glasgow', region: 'Scotland', lat: 55.86, lon: -4.25, weight: 0.12 },
    { city: 'Cardiff', region: 'Wales', lat: 51.48, lon: -3.18, weight: 0.1 },
  ] },
  { code: 'IN', country: 'India', share: 0.092, cities: [
    { city: 'Mumbai', region: 'Maharashtra', lat: 19.08, lon: 72.88, weight: 0.28 },
    { city: 'Bengaluru', region: 'Karnataka', lat: 12.97, lon: 77.59, weight: 0.26 },
    { city: 'Delhi', region: 'Delhi', lat: 28.61, lon: 77.21, weight: 0.24 },
    { city: 'Chennai', region: 'Tamil Nadu', lat: 13.08, lon: 80.27, weight: 0.12 },
    { city: 'Kolkata', region: 'West Bengal', lat: 22.57, lon: 88.36, weight: 0.1 },
  ] },
  { code: 'CA', country: 'Canada', share: 0.062, cities: [
    { city: 'Toronto', region: 'Ontario', lat: 43.65, lon: -79.38, weight: 0.42 },
    { city: 'Vancouver', region: 'British Columbia', lat: 49.28, lon: -123.12, weight: 0.28 },
    { city: 'Montreal', region: 'Quebec', lat: 45.5, lon: -73.57, weight: 0.2 },
    { city: 'Calgary', region: 'Alberta', lat: 51.05, lon: -114.07, weight: 0.1 },
  ] },
  { code: 'AU', country: 'Australia', share: 0.048, cities: [
    { city: 'Sydney', region: 'New South Wales', lat: -33.87, lon: 151.21, weight: 0.42 },
    { city: 'Melbourne', region: 'Victoria', lat: -37.81, lon: 144.96, weight: 0.35 },
    { city: 'Brisbane', region: 'Queensland', lat: -27.47, lon: 153.03, weight: 0.13 },
    { city: 'Perth', region: 'Western Australia', lat: -31.95, lon: 115.86, weight: 0.1 },
  ] },
  { code: 'DE', country: 'Germany', share: 0.041, cities: [
    { city: 'Berlin', region: 'Berlin', lat: 52.52, lon: 13.41, weight: 0.4 },
    { city: 'Munich', region: 'Bavaria', lat: 48.14, lon: 11.58, weight: 0.25 },
    { city: 'Hamburg', region: 'Hamburg', lat: 53.55, lon: 9.99, weight: 0.2 },
    { city: 'Cologne', region: 'North Rhine-Westphalia', lat: 50.94, lon: 6.96, weight: 0.15 },
  ] },
  { code: 'BR', country: 'Brazil', share: 0.039, cities: [
    { city: 'Sao Paulo', region: 'Sao Paulo', lat: -23.55, lon: -46.63, weight: 0.45 },
    { city: 'Rio de Janeiro', region: 'Rio de Janeiro', lat: -22.91, lon: -43.17, weight: 0.3 },
    { city: 'Belo Horizonte', region: 'Minas Gerais', lat: -19.92, lon: -43.94, weight: 0.25 },
  ] },
  { code: 'PH', country: 'Philippines', share: 0.031, cities: [
    { city: 'Manila', region: 'Metro Manila', lat: 14.6, lon: 120.98, weight: 0.6 },
    { city: 'Cebu City', region: 'Central Visayas', lat: 10.32, lon: 123.89, weight: 0.4 },
  ] },
  { code: 'FR', country: 'France', share: 0.028, cities: [
    { city: 'Paris', region: 'Ile-de-France', lat: 48.86, lon: 2.35, weight: 0.6 },
    { city: 'Lyon', region: 'Auvergne-Rhone-Alpes', lat: 45.76, lon: 4.84, weight: 0.22 },
    { city: 'Marseille', region: "Provence-Alpes-Cote d'Azur", lat: 43.3, lon: 5.37, weight: 0.18 },
  ] },
  { code: 'NL', country: 'Netherlands', share: 0.021, cities: [
    { city: 'Amsterdam', region: 'North Holland', lat: 52.37, lon: 4.9, weight: 0.6 },
    { city: 'Rotterdam', region: 'South Holland', lat: 51.92, lon: 4.48, weight: 0.4 },
  ] },
  { code: 'MX', country: 'Mexico', share: 0.026, cities: [
    { city: 'Mexico City', region: 'Mexico City', lat: 19.43, lon: -99.13, weight: 0.65 },
    { city: 'Guadalajara', region: 'Jalisco', lat: 20.66, lon: -103.35, weight: 0.35 },
  ] },
  { code: 'JP', country: 'Japan', share: 0.024, cities: [
    { city: 'Tokyo', region: 'Tokyo', lat: 35.68, lon: 139.69, weight: 0.7 },
    { city: 'Osaka', region: 'Osaka', lat: 34.69, lon: 135.5, weight: 0.3 },
  ] },
  { code: 'ID', country: 'Indonesia', share: 0.023, cities: [
    { city: 'Jakarta', region: 'Jakarta', lat: -6.21, lon: 106.85, weight: 0.7 },
    { city: 'Surabaya', region: 'East Java', lat: -7.25, lon: 112.75, weight: 0.3 },
  ] },
  { code: 'ES', country: 'Spain', share: 0.019, cities: [
    { city: 'Madrid', region: 'Madrid', lat: 40.42, lon: -3.7, weight: 0.55 },
    { city: 'Barcelona', region: 'Catalonia', lat: 41.39, lon: 2.17, weight: 0.45 },
  ] },
  { code: 'IT', country: 'Italy', share: 0.017, cities: [
    { city: 'Rome', region: 'Lazio', lat: 41.9, lon: 12.5, weight: 0.55 },
    { city: 'Milan', region: 'Lombardy', lat: 45.46, lon: 9.19, weight: 0.45 },
  ] },
  { code: 'ZA', country: 'South Africa', share: 0.014, cities: [
    { city: 'Johannesburg', region: 'Gauteng', lat: -26.2, lon: 28.05, weight: 0.6 },
    { city: 'Cape Town', region: 'Western Cape', lat: -33.92, lon: 18.42, weight: 0.4 },
  ] },
  { code: 'NG', country: 'Nigeria', share: 0.013, cities: [
    { city: 'Lagos', region: 'Lagos', lat: 6.52, lon: 3.38, weight: 0.75 },
    { city: 'Abuja', region: 'FCT', lat: 9.06, lon: 7.5, weight: 0.25 },
  ] },
  { code: 'PL', country: 'Poland', share: 0.012, cities: [
    { city: 'Warsaw', region: 'Masovia', lat: 52.23, lon: 21.01, weight: 0.6 },
    { city: 'Krakow', region: 'Lesser Poland', lat: 50.06, lon: 19.94, weight: 0.4 },
  ] },
  { code: 'SE', country: 'Sweden', share: 0.01, cities: [
    { city: 'Stockholm', region: 'Stockholm', lat: 59.33, lon: 18.06, weight: 0.7 },
    { city: 'Gothenburg', region: 'Vastra Gotaland', lat: 57.71, lon: 11.97, weight: 0.3 },
  ] },
  { code: 'NP', country: 'Nepal', share: 0.009, cities: [
    { city: 'Kathmandu', region: 'Bagmati', lat: 27.72, lon: 85.32, weight: 0.8 },
    { city: 'Pokhara', region: 'Gandaki', lat: 28.21, lon: 83.99, weight: 0.2 },
  ] },
  { code: 'SG', country: 'Singapore', share: 0.008, cities: [
    { city: 'Singapore', region: 'Singapore', lat: 1.35, lon: 103.82, weight: 1 },
  ] },
  { code: 'IE', country: 'Ireland', share: 0.008, cities: [
    { city: 'Dublin', region: 'Leinster', lat: 53.35, lon: -6.26, weight: 1 },
  ] },
  { code: 'NZ', country: 'New Zealand', share: 0.007, cities: [
    { city: 'Auckland', region: 'Auckland', lat: -36.85, lon: 174.76, weight: 0.65 },
    { city: 'Wellington', region: 'Wellington', lat: -41.29, lon: 174.78, weight: 0.35 },
  ] },
  { code: 'AE', country: 'United Arab Emirates', share: 0.007, cities: [
    { city: 'Dubai', region: 'Dubai', lat: 25.2, lon: 55.27, weight: 1 },
  ] },
  { code: 'AR', country: 'Argentina', share: 0.007, cities: [
    { city: 'Buenos Aires', region: 'Buenos Aires', lat: -34.6, lon: -58.38, weight: 1 },
  ] },
  { code: 'KR', country: 'South Korea', share: 0.006, cities: [
    { city: 'Seoul', region: 'Seoul', lat: 37.57, lon: 126.98, weight: 1 },
  ] },
  { code: 'TR', country: 'Turkey', share: 0.005, cities: [
    { city: 'Istanbul', region: 'Istanbul', lat: 41.01, lon: 28.98, weight: 1 },
  ] },
];

export const DEVICE_MIX: { device: 'MOBILE' | 'DESKTOP' | 'TABLET'; share: number; os: [string, number][]; browsers: [string, number][] }[] = [
  { device: 'MOBILE', share: 0.63, os: [['Android', 0.55], ['iOS', 0.45]], browsers: [['Chrome', 0.52], ['Safari', 0.38], ['Samsung Internet', 0.07], ['Firefox', 0.03]] },
  { device: 'DESKTOP', share: 0.32, os: [['Windows', 0.62], ['macOS', 0.29], ['Linux', 0.06], ['ChromeOS', 0.03]], browsers: [['Chrome', 0.58], ['Edge', 0.16], ['Safari', 0.14], ['Firefox', 0.1], ['Opera', 0.02]] },
  { device: 'TABLET', share: 0.05, os: [['iPadOS', 0.72], ['Android', 0.28]], browsers: [['Safari', 0.66], ['Chrome', 0.34]] },
];

export const SOURCE_MIX: { source: string; share: number; referrers: string[] }[] = [
  { source: 'organic', share: 0.46, referrers: ['https://www.google.com/', 'https://www.bing.com/', 'https://duckduckgo.com/', 'https://search.yahoo.com/'] },
  { source: 'direct', share: 0.24, referrers: [] },
  { source: 'social', share: 0.2, referrers: ['https://www.reddit.com/', 'https://t.co/', 'https://www.facebook.com/', 'https://news.ycombinator.com/', 'https://bsky.app/', 'https://www.youtube.com/'] },
  { source: 'referral', share: 0.1, referrers: ['https://news.google.com/', 'https://flipboard.com/', 'https://www.smartnews.com/', 'https://feedly.com/'] },
];

export const CAMPAIGNS = [
  { utmSource: 'newsletter', utmMedium: 'email', utmCampaign: 'volt-weekly' },
  { utmSource: 'reddit', utmMedium: 'cpc', utmCampaign: 'aetherfall-launch' },
  { utmSource: 'twitter', utmMedium: 'social', utmCampaign: 'awards-season-26' },
  { utmSource: 'partner', utmMedium: 'referral', utmCampaign: 'vireo-crosspost' },
];

/** Reader age skew for an entertainment title: young, but not only young. */
export const AGE_MIX: [string, number][] = [
  ['13-17', 0.07],
  ['18-24', 0.23],
  ['25-34', 0.31],
  ['35-44', 0.19],
  ['45-54', 0.11],
  ['55-64', 0.06],
  ['65+', 0.03],
];

export const GENDER_MIX: [string, number][] = [
  ['MALE', 0.54],
  ['FEMALE', 0.38],
  ['NON_BINARY', 0.03],
  ['PREFER_NOT_TO_SAY', 0.05],
];

export const READER_FIRST_NAMES = ['Amara', 'Ben', 'Chiara', 'Dmitri', 'Elif', 'Farid', 'Grace', 'Hiro', 'Imani', 'Jonas', 'Kaia', 'Lucas', 'Mina', 'Niall', 'Oyin', 'Pia', 'Quinn', 'Rosa', 'Sami', 'Tobias', 'Uma', 'Viktor', 'Wren', 'Xiulan', 'Yara', 'Zane', 'Aditi', 'Boris', 'Celia', 'Dawit'];
export const READER_LAST_NAMES = ['Achterberg', 'Bergstrom', 'Cardoso', 'Delgado', 'Eriksen', 'Fontaine', 'Gallagher', 'Hoffmann', 'Ibarra', 'Jankowski', 'Kimura', 'Lindgren', 'Moretti', 'Nakamura', 'Owusu', 'Petrov', 'Quintero', 'Ramachandran', 'Silva', 'Tanaka', 'Ustinov', 'Villanueva', 'Wojcik', 'Xu', 'Yilmaz', 'Zhang'];
