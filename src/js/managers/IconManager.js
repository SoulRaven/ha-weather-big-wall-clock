import { Config } from "@Config";
import { EventBusMixin } from "@EventBus";

import alertsPath from '../../other/icons/alerts.json';
import amchartsPath from '../../other/icons/amcharts.json';
import basmiliusPath from '../../other/icons/basmilius.json';
import metnoPath from '../../other/icons/metno.json';
import mskinThingsPath from '../../other/icons/mskinThings.json';
import owmPath from '../../other/icons/owm.json';

import { loadIcons } from '../utils/loaders.js';
import { logger } from '../utils/logger.js';
import { Strings } from '../utils/strings.js';


const filesToFetch = [
	amchartsPath,
	mskinThingsPath,
	metnoPath,
	basmiliusPath,
	owmPath,
	alertsPath
];

const iconsData = await loadIcons(filesToFetch);

const weatherIcons = iconsData.weatherIcons,
	alertIcons = iconsData.alertIcons;

/**
 * Icon Manager class to handle weather and alert icons
 */
export class IconManager extends EventBusMixin() {

	#mediaPath = Config.get('iconsPath');

	constructor(isNight) {
		super();
		this.weatherIcons = weatherIcons;
		this.alertIcons = alertIcons;

		this.defaultWeatherIcons = {
			iconSet: 'openweathermap',
			type: 'static',
			path: `${this.#mediaPath}/weather/owm/`
		};

		this.defaultWeatherAlertsIcons = {
			iconSet: 'nrkno',
			type: 'static',
			path: `${this.#mediaPath}/alerts/`
		};

		this.isNight = isNight;

		this.weatherConfig = { ...this.defaultWeatherIcons, ...Config.get('weatherConfig.icons') };
		this.weatherConfigAlerts = { ...this.defaultWeatherAlertsIcons, ...Config.get('weatherConfig.iconsAlerts') };


		this.iconsSetObj = this.iconsSetWeather;
		this.iconsSetAlertsObj = this.iconsSetAlerts;

		this.on('hass:is_night', (opt) => {
			this.isNight = opt.detail.is_night;
		});
	}

	static initIconManager(isNight) {
		return new IconManager(isNight);
	}

	get iconsSetWeather() {
		const iconsSetAlias = this.weatherConfig.iconSet;

		let iconsObjAlias = Object.keys(this.weatherIcons).find(key => this.weatherIcons[key].options.alias === iconsSetAlias);

		if (!iconsObjAlias) {
			iconsObjAlias = this.defaultWeatherIcons.iconSet;
			logger.warn(`Weather icons set with alias ${iconsSetAlias} is not registered. Using default (${iconsObjAlias})`);
		}

		return this.weatherIcons[iconsObjAlias];
	}

	/**
	 *
	 * @returns {*}
	 */
	get iconsSetAlerts() {
		const iconsSetAlias = this.weatherConfigAlerts.iconSet;

		let iconsAlias = Object.keys(this.alertIcons).find(key => this.alertIcons[key].options.alias === iconsSetAlias);

		if (!iconsAlias) {
			iconsAlias = this.defaultWeatherAlertsIcons.iconSet;
			logger.warn(`Weather alerts icons set with alias ${iconsSetAlias} is not registered. Using default (${iconsAlias})`);
		}

		return this.alertIcons[iconsAlias];
	}

	/**
	 * Assign an icon for each weather condition that is present in the weather array
	 * @param weather
	 * @private
	 */
	_getWeatherIcons(weather) {
		let icons = [];

		weather.forEach((weatherObj) => {
			const description = Strings.tokenize(weatherObj.description),
				iconSet = this.iconsSetObj[description],
				iconSetType = this.iconsSetObj.options.type.includes(this.weatherConfig.type) ? this.weatherConfig.type : 'static',
				iconSetPath = this.iconsSetObj.options.path,
				isDayNight = this.isNight ? 'night' : 'day';

			if (iconSet) {
				const icon = iconSet[isDayNight];
				icons.push(`${this.#mediaPath}${iconSetPath}${iconSetType}/${icon}`);
			} else {
				logger.warn(`Weather icon for ${description} is not registered. Using default icon.`);
				icons.push(`${this.#mediaPath}weather/not-available.svg`);
			}

		});
		return icons;
	}

	/**
	 *
	 * @param awareness_level
	 * @param awareness_type
	 * @returns {string}
	 * @private
	 */
	_getWeatherAlertIcon(awareness_level, awareness_type) {
		const alertIcons = this.iconsSetAlertsObj,
			iconSetType = alertIcons.options.type.includes(this.weatherConfigAlerts.type) ? this.weatherConfigAlerts.type : 'static',
			iconSetPath = alertIcons.options.path;

		let alertLevel = '';

		// Mapping the awareness level to the alert level
		switch (awareness_level) {
			case 2:
				alertLevel = 'yellow';
				break;
			case 3:
				alertLevel = 'orange';
				break;
			case 4:
				alertLevel = 'red';
				break;
			default:
				alertLevel = 'default';
		}

		if (!alertLevel) {
			logger.warn(`Weather alert icon for level ${awareness_level} is not registered. Using default icon.`);
		}

		let iconsLevel = alertIcons[alertLevel],
			iconName = '';

		// mapping the awareness type to the icon name
		switch (awareness_type) {
			case 1:
				iconName = 'wind';
				break;
			case 2:
				iconName = 'snow';
				break;
			case 3:
				break;
			case 4:
				break;
			case 5:
				break;
			case 6:
				iconName = 'ice';
				break;
			case 10:
				iconName = 'rain';
				break;
		}

		let icon = iconsLevel[iconName];

		// combine icon level with icon name
		return `${this.#mediaPath}${iconSetPath}${iconSetType}/${icon}`;
	}

}
