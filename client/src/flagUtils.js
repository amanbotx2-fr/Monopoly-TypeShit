// City → ISO 3166-1 alpha-2 country codes for flag images.
const CITY_COUNTRY = {
	Cairo: 'eg',
	Lagos: 'ng',
	Bangkok: 'th',
	Jakarta: 'id',
	Manila: 'ph',
	Lisbon: 'pt',
	Madrid: 'es',
	Barcelona: 'es',
	Vienna: 'at',
	Prague: 'cz',
	Warsaw: 'pl',
	Dubai: 'ae',
	Mumbai: 'in',
	Delhi: 'in',
	Seoul: 'kr',
	Osaka: 'jp',
	Singapore: 'sg',
	Stockholm: 'se',
	Amsterdam: 'nl',
	Paris: 'fr',
	London: 'gb',
	Tokyo: 'jp',
};

/**
 * Returns a flagcdn.com URL for the given city name, or null if unknown.
 * @param {string} cityName
 * @returns {string|null}
 */
export function flagUrl(cityName) {
	const code = CITY_COUNTRY[cityName];
	return code ? `https://flagcdn.com/w80/${code}.png` : null;
}
