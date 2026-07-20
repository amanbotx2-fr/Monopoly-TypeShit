const ADJECTIVES = [
	'Lucky',
	'Golden',
	'Board',
	'Capital',
	'Clever',
	'Dice',
	'Rapid',
	'Urban',
	'Royal',
	'Silent',
	'Grand',
	'Savvy',
	'Swift',
	'Noble',
];

const NOUNS = [
	'Tycoon',
	'Trader',
	'Master',
	'King',
	'Investor',
	'Wizard',
	'Builder',
	'Collector',
	'Property',
	'Merchant',
	'Mogul',
	'Banker',
];

function randomItem(items, random) {
	return items[Math.floor(random() * items.length)];
}

export default function generateNickname(random = Math.random) {
	const nickname = `${randomItem(ADJECTIVES, random)}${randomItem(NOUNS, random)}`;
	const suffix = random() < 0.25 ? Math.floor(random() * 999) + 1 : '';

	return `${nickname}${suffix}`;
}
