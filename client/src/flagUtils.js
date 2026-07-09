/**
 * Returns the icon path for a tile def, or null.
 *
 * Priority:
 *   1. `def.icon` — set by the board definition (supports custom maps).
 *   2. Country-flag fallback for legacy property tiles without explicit icon.
 *
 * Paths are relative to the public/ folder (e.g. "flags/eg.svg").
 *
 * @param {{ icon?: string, type?: string, name?: string }} def
 * @returns {string|null}
 */
export function tileIcon(def) {
	if (!def) return null;
	if (def.icon) return def.icon;
	// Legacy fallback for default-board property tiles
	if (def.type === 'property') {
		const code = CITY_COUNTRY[def.name];
		return code ? `/flags/${code}.svg` : null;
	}
	return null;
}

// City → ISO 3166-1 alpha-2 country codes (used as fallback when def.icon is unset).
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

