import { css, html, LitElement } from "lit";
import { classMap } from "lit/directives/class-map.js";

import { Config } from "@Config";
import bus, { EventBusMixin } from "@EventBus";

import { DateTimeManager } from './managers/DateTimeManager.js';

import { IconManager } from './managers/IconManager.js';
import { MediaManager } from './managers/mediaManager.js';

import { Helpers } from "./utils/helpers.js";
import { logger } from "./utils/logger.js";

import { getWeatherProvider } from './weather/index.js';

import Style from "../scss/style.scss";

/* -------------------------------------------------------
   WALL CLOCK VIDEO CARD – FULL FEATURE VERSION
------------------------------------------------------- */

let __DEBUG__ = Helpers.hasDebug();

const hacs_path = Config.get('app.hacs_path'),
	WORKER = new SharedWorker(
		`${hacs_path}/time.worker.js`, {
			type: 'module',
			name: "Time-Sync Worker - Weather big clock"
		}
	);

export class WallClockVideo extends EventBusMixin(LitElement) {

	static cardName = 'Wall Clock Video';
	static cardType = 'big-wall-clock-video';

	// define the mediaManager container id in the div that keeps the video/images
	#mediaContainer = 'mediaContainer';

	/* --- HASS browser object --- */
	static properties = {

		hass: { type: Object },
		narrow: { type: Boolean },
		route: { type: Object },

		config: { type: Object },
		kiosk: { type: Boolean },

		classes: {}, // style classes that store the classes states

		_locale: { state: true }, // state of the language
		_entities: { type: Array, state: true }, // internal state of the entities configures by the user

		day_night_entity: { type: Object },
		is_night: { type: Boolean },
		theme: { type: Object },

		weather_data: { type: Object },
		forecast: { type: Object },
		local_sensors: { type: Object },

		timeHour: { type: String },
		timeShort: { type: String }, // manage hours and minutes separately
		seconds: { type: String },
		showSeconds: { type: Boolean },
		ampm: { type: String },

		dateDisplay: { type: String },  // New property

		mediaBackground: { state: true }, // used to store the media background html object

		debug: { type: Boolean }
	};

	/* --- STYLES --- */
	static styles = css`${Style}`;

	constructor(...args) {
		super(...args);

	  this.hass = null;

		this.weather = "";
		this.weatherProvider = null;

		// state of the main content. Will be True when the initCard is called, and false when the disconnectedCallback is called
		this.content = false;

		// principal managers of the card
	  this.dateTimeManager = null;
		this.mediaManager = null;
		this.iconManager = null;

		this.showSeconds = false;

		this._entities = []; // set the internal state of the caching for entity's set by the client

	}

	/* ---------------- CONFIG ---------------- */

	setConfig(config) {
		if (!config) {
			throw new Error('Invalid configuration');
		}

		this.emit('config:load:pre', config);

		// to get the locale are only two options, default from hass or from the config
		// if the config is not available, even if the default is set to 'en' then fallback to hass.language
		if (Config.get('locale') !== this._locale) {
			this._locale = Config.get('locale', this._hass?.language ? this._hass?.language : 'en');
		}

		i18n.setLang(this._locale);

		// check if the noPanels settings are enabled
		this.classes = {
			'middle-noPanels': {
				'middle-noPanels': Config.get('hidePanels')
			},
			'center-noPanels': {
				'center-noPanels': Config.get('hidePanels')
			}
		};

		this.showSeconds = Config.get('timeFormat')?.includes('ss') || Config.get('timeFormat')?.includes('s') || false;
		this.showAMPM = (Config.get('timeFormat')?.includes('hh') || Config.get('timeFormat')?.includes('h')) && Config.get('showAMPM') || false;
		this.day_night_entity = Config.get('day_night_entity', false);
		this._localSensor = Config.get('localSensors', []);

		// Initialize DateTime Manager with config
		// relais on the fapt that the config is already loaded using emit event
		this.dateTimeManager = new DateTimeManager(new Date());
		this.mediaManager = MediaManager.initMediaManager();

		// set the hass object to the weather provider that supports hass
		this.weatherProvider = getWeatherProvider(Config.get('weatherConfig.weatherProvider'));
		if (this.weatherProvider && this.weatherProvider.setHass) {
			this.weatherProvider.setHass(this._hass);
		}

		// --- KIOSK logic ---
		if (Helpers.isKioskActive()) {
			this._enableKioskMode();
		}

		this.emit('config:load:post', config);

	}

	/**
	 *
	 * @param hass
	 */
	set hass(hass) {
		const oldHass = this._hass;
		this._hass = hass;

		Config.setHass(hass);

		// call day/night state switch
		if (this.day_night_entity) {
			const nightState = Helpers.isNight(this.day_night_entity, hass);

			if (nightState !== this.is_night) {
				this.emit('hass:is_night', {
					is_night: nightState
				});
				this.is_night = nightState;
				this.theme = this.is_night ? Config.get('theme.night') : Config.get('theme.day');
			}
		}

		if (!oldHass && hass || (oldHass && window.location.pathname.includes('big-weather-clock-panel'))) {
			// If weather is stale, refresh it
			if (this.weatherProvider && this.weatherProvider.setHass) {
				this.weatherProvider.setHass(hass);
			}

			if (this.mediaManager && this.mediaManager.setHass) {
				this.mediaManager.setHass(hass);
			}
		}
	}

	/**
	 *
	 * @returns {*}
	 */
	get hass() {
		return this._hass;
	}

	/**
	 * Enable kiosk mode by hiding the sidebar and header
	 * @private
	 */
	_enableKioskMode() {
		// Use a timeout because the sidebar might not be in the DOM yet
		setTimeout(() => {
			try {
				// Find the Home Assistant Main container
				const homeAssistant = document.querySelector("home-assistant");
				const main = homeAssistant?.shadowRoot?.querySelector("home-assistant-main")?.shadowRoot;

				// Hide Sidebar and Header
				const drawer = main?.querySelector("ha-drawer");
				if (drawer) {
					// This effectively hides the sidebar 'sliver' and the menu
					drawer.style.setProperty("--mdc-drawer-width", "0px");
					drawer.style.setProperty("--mdc-top-app-bar-width", "100%");
				}

				// Optional: Hide the header if using kiosk mode
				const header = main?.querySelector("app-header");
				if (header) header.style.display = "none";

			} catch (e) {
				console.error("Kiosk mode failed to hide sidebar", e);
			}
		}, 200);
	}

	/**
	 *
	 */
	connectedCallback() {
		super.connectedCallback();

		this.observeVisibility(this, (isVisibile, entry) => {
			this._handleVisibility(isVisibile, entry);
		});

		this.observePageVisibility(isVisibile => {
			this._handleVisibility(isVisibile);
		});

		Config.on('config:initial-load', () => {
			this.requestUpdate();
		});

		// start the timeworker on construct
		WORKER.port.start();
	}

	/**
	 *
	 */
	disconnectedCallback() {
		// start the timeworker on construct
		// WORKER.port.close();

		document.removeEventListener('visibilitychange', this._onVisibilityChange);
		// Clean up the listener when the card is removed
		window.removeEventListener('resize', () => this.adjustLayout());
		window.removeEventListener("location-changed", this._navListener);

		this.content = false;

		// @todo check if is necessary when the browser tab became inactive
		if (this.mediaManager) {
			// this.mediaManager.destroy();
		}

		super.disconnectedCallback();
	}

	/**
	 * Handles the visibility state of a component and manages media playback accordingly.
	 *
	 * @param {boolean} isVisibile - A flag indicating whether the component is visible.
	 * @param {IntersectionObserverEntry|null} [entry=null] - An optional IntersectionObserverEntry object providing visibility details.
	 * @return {void}
	 */
	_handleVisibility(isVisibile, entry = null) {
		if (isVisibile) {
			this.requestUpdate();
			this.mediaManager?.resume();
		} else {
			this.mediaManager?.pause();
		}
	}

	updated(changedProperties) {
		super.updated(changedProperties);

		// If config or night-state changed, re-render the media
		if (changedProperties.has('config') || changedProperties.has('is_night')) {
			// const container = this.shadowRoot.getElementById(this.#mediaContainer);
			// container = this.renderRoot.getElementById(this.#mediaContainer);
			// if (container && this.mediaManager) {
			// this.mediaManager.renderElements(container);
			// }
		}
	}

	/**
	 *
	 * @param _changedProperties
	 * @returns {Promise<void>}
	 */
	async firstUpdated(_changedProperties) {
		super.firstUpdated(_changedProperties);

		let el = this;

		this.observeResize(this, (rect) => {
			this.adjustLayout();
			this.requestUpdate();
		});

		// on this the card is started with all the blocks
		if (!this.content) {
			this.content = true;

			// start the date time task
			this.startClockUpdates();

			this._updateWeather().then();

			// init the icon manager to be used in the weather conditions and alerts
			this.iconManager = IconManager.initIconManager(this.is_night);
		}

		// fetch local sensors based on the user config
		await this._fetchDeviceEntities().then();

		const container = this.renderRoot.getElementById(this.#mediaContainer);
		if (container) {
			this.emit('FIRST_UPDATED', {
				container
			});
		}
	}

	/**
	 * Adjust the layout based on panel mode and header visibility
	 */
	adjustLayout() {
		const card = this.renderRoot?.querySelector('ha-card');

		if (!card) return;

		// Check if the header height is effectively zero
		const headerHeight = getComputedStyle(document.documentElement)
			.getPropertyValue('--header-height').trim();

		const isHeaderHidden = headerHeight === '0px' || headerHeight === '0';

		if (Helpers.isKioskActive()) {
			card.style.setProperty('height', '100vh', 'important');
			card.style.setProperty('margin', '0', 'important');
			card.style.setProperty('border-radius', '0', 'important');
		}
	}

	/* ---------------- Local sensors ---------------- */
	async _fetchDeviceEntities() {
		if (!this._hass) {
			return;
		}

		try {
			const allEntities = await this._hass.callWS({
				type: "config/entity_registry/list",
			});

			this._entities = this._localSensor.map(sensor => {
				const deviceEntities = allEntities.filter(e => e.device_id === sensor.device_entity).map(e => e.entity_id);
				const extras = sensor?.extra_entities || [];

				return {
					...sensor,
					resolvedEntities: [...new Set([...deviceEntities, ...extras])] // Combine and deduplicate entities
				};
			});

		} catch (e) {
			logger.error("Failed to fetch device entities:", e);
		}
	}

	/**
	 * fetch data from hass objects and return an array of objects ready to be rendered
	 * @returns array
	 * @private
	 */
	_processLocalSensors() {
		if (!this._entities || !this._hass) return null;

		let locations = {};

		// Default Icon Mapping
		const defaultIcons = {
			temperature: 'mdi:thermometer',
			humidity: 'mdi:water-percent',
			battery: 'mdi:battery',
			light: 'mdi:lightbulb',
			default: 'mdi:eye'
		};


		this._entities.forEach(configGroup => {
			const locationName = configGroup.name;

			// Initialize the location object
			locations[locationName] = {
				name: locationName,
				is_stale: false,
				mold_risk: null,
				temp: [],
				hum: [],
				battery: [],

				// Keeping the full list just in case
				// @todo: possible is not necessary
				all_entities: []
			};

			let rawTemp = null;
			let rawHum = null;

			configGroup.resolvedEntities.forEach(object => {
				const stateObj = this._hass.states[object];
				if (!stateObj) return;

				const attrs = stateObj.attributes || {};
				const deviceClass = attrs.device_class;

				// Format the last updated string
				const timeAgo = Helpers.getRelativeTime(stateObj.last_updated),
					isStale = ['unavailable', 'Unavailable', 'unknown'].includes(stateObj.state),
					state = this._hass.formatEntityState(stateObj);

				const entityData = {
					id: object,
					name: attrs.friendly_name || object || 'N/A',
					label: attrs.friendly_name,
					device_class: deviceClass || 'none',
					state: isStale ? 'N/A' : state,
					icon: attrs.icon || defaultIcons[deviceClass] || defaultIcons.default,
					last_updated: timeAgo,
					stale: isStale
				};

				// console.log(entityData);

				// Assign to specific sensor slots based on device_class
				if (deviceClass === 'temperature') {
					locations[locationName].temp.push(entityData);
					rawTemp = parseFloat(stateObj.state);
				} else if (deviceClass === 'humidity') {
					locations[locationName].hum.push(entityData);
					rawHum = parseFloat(stateObj.state);
				} else if (deviceClass === 'battery' || attrs.battery_level || attrs.battery) {
					// If it's a battery sensor OR an entity with a battery attribute
					if (!locations[locationName].battery || deviceClass === 'battery') {
						// Ensure the state shows the battery level if it was an attribute
						entityData.color = Helpers.getBatteryInfo(stateObj.state);
						if (deviceClass !== 'battery') {
							entityData.state = this._hass.formatEntityAttributeValue(stateObj, 'battery_level') ||
								this._hass.formatEntityAttributeValue(stateObj, 'battery');
							entityData.icon = defaultIcons.battery;

						}
						locations[locationName].battery.push(entityData);
					}
				}

				// If any single entity is stale, the whole location is flagged
				if (isStale) {
					locations[locationName].is_stale = true;
				}


				locations[locationName].all_entities.push(entityData);
			});

			// Cross-entity logic for the location
			const mainT = locations[locationName]?.temp[0]?.state,
				mainH = locations[locationName]?.hum[0]?.state;
			if (mainT && mainH) {
				locations[locationName].mold_risk = Helpers._calculateMoldRisk(parseFloat(mainT), parseFloat(mainH));
			}
		});

		return Object.values(locations);
	}

	_renderLocalSensors() {
		if (!this._entities) return html`<div>Loading Registries...</div>`;

		const localData = this._processLocalSensors();

		return html`
			${localData.map((data) => {
		return html`
					<div class="sensor-block ${data.is_stale ? 'stale' : ''}">
						<div class="sensor-header">
							<h3 class="location-title">${data.name}</h3>
							${data.is_stale ? html`
								<ha-icon icon="mdi:alert-circle-outline"
								         style="color: var(--error-color)"></ha-icon>` : ''}
						</div>
						<div class="sensor-grid">
							<!-- Temp -->
							${data.temp.map(t => html`
		            <div class="sensor-row" ${t.stale ? 'stale' : ''}>

			            <div class="sensor-details">
				            <ha-icon icon="${t.icon}"></ha-icon>
				            <div class="sensor-value">${t.state}</div>

			            </div>
			            <span class="sensor-time">${t.last_updated}</span>
		            </div>
							`)}
							<!-- Humidity -->
							${data.hum.map(h => html`
		            <div class="sensor-row ${h.stale ? 'stale' : ''}">

			            <div class="sensor-details">
				            <ha-icon icon="${h.icon}"></ha-icon>
				            <div class="sensor-value">${h.state}</div>

			            </div>
			            <span class="sensor-time">${h.last_updated}</span>
		            </div>
		          `)}
						</div>
						<div class="footer">
							${data.battery.map(b => html`
									<div class="battery-info ${b.stale ? 'stale' : ''}">
										<div class="sensor-details">
											<ha-icon icon="${b.icon}" style="color: ${b.color}"></ha-icon>
											<dic class="sensor-value">${b.state}</dic>
											<div class="sensor-label">${b.label}</div>
										</div>
									</div>
								`)}

							${data.mold_risk ? html`
		            	<div class="mold-badge ${data.mold_risk.cssClass}" >
				            ${data.mold_risk.icon ? html`
					            <ha-icon icon="${data.mold_risk.icon}"></ha-icon>
				            ` : ''}
				            ${i18n._('global.mold_risk')} ${data.mold_risk.level}
			            </div>
		          	` : ''}
						</div>
					</div>
				`;
	})}
    `;
	}

	/* ---------------- Weather data ---------------- */

	/**
	 *
	 * @returns {Promise<void>}
	 * @private
	 */
	async _updateWeather() {

		const weather_config = {
			...Config.get('weatherConfig'),
			...{ locale: this._locale, timezone: Config.get('timezone') }
		};

		if (this.weatherProvider && this.weatherProvider.fetchWeather) {
			await this.weatherProvider.fetchWeather(WORKER, weather_config);
		}

		WORKER.port.addEventListener('message', (msg) => {
			if (msg.data.type === 'WEATHER_UPDATE') {
				logger.debug('Weather update received');

				const weatherData = msg.data.weather;

				if (weatherData && weatherData !== this.weather_data) {
					this.weather_data = weatherData;
					// brodcast the current weather condition to the media manager
					this.emit('WEATHER_CONDITION_CHANGED', {
						current_weather: this.weather_data.current,
						isNight: this.is_night
					});
				}
			}
		});
	}

	/* ---------------- Date/Time block  ---------------- */

	startClockUpdates() {

		this.dateTimeManager.startAutoUpdate(WORKER,(dateTime) => {
			this.timeHour = dateTime.components.timeObj.hours;
			this.timeShort = dateTime.components.timeObj.timeShort;
			this.seconds = dateTime.components.timeObj.seconds;
			this.ampm = dateTime.components.timeObj.ampm;
			this.dateDisplay = dateTime.components.dateObj.dateFormatted;

			// check if is day or night
			this.is_night = Helpers.isNight(this.day_night_entity, this._hass);
		});
	}

	/* ---------------- RENDER ---------------- */

	_currentWeatherElement(icons, label, value) {
		const showLabels = Config.get('weatherConfig.showLabels');
		return html`
      <div class="metric-item">
        <ha-icon class="metric-icon" .icon="${icons}"></ha-icon>
        <div class="metric-data">
	        ${showLabels ?
		        html`<span class="label">${label}</span>` :
		        ''}
          <span class="value">${value}</span>
        </div>
      </div>
    `;
	}

	/**
	 * Process the weather description and add the i18n from the locale files
	 * Special cases for the conditions when the clouds are part of the id spread description
	 * In normal conditions the description is working also for other providers, when the case is for OpenWeatherMap case
	 * @param weatherObj
	 * @returns {string}
	 * @private
	 */
	_processWeatherCondition(weatherObj) {
		if (!weatherObj || weatherObj.length === 0) return '';
		const owm_conditions = Config.get('weatherConfig.owm_conditions');

		let condition = [];
		if (owm_conditions === 'basic') {
			condition = i18n._owmMain(weatherObj);
			return condition[0];
		} else if (owm_conditions === 'detailed') {
			condition = i18n._owmDesc(weatherObj);
			return condition.join(', ');
		} else {
			throw new Error(`Invalid OWM conditions: ${owm_conditions}. Check documentation.`);
		}
	}

	_renderCurrentWeather() {

		if (!this.weather_data?.current) return html``;

		const current = this.weather_data.current;

		return html`
			<div class="main-data">
				<img class="weather-current-icon" src="${this.iconManager?._getWeatherIcons(current.weather)[0]}" alt="${current.name}">
				<div class="weather-current-temperature">${current.temp.join('')}</div>
			</div>
			<div class="main-description">
				<div class="weather-current-name">${this._processWeatherCondition(current.weather)}</div>
			</div>
			<div class="metrics-panel">
				${this._currentWeatherElement('mdi:thermometer', i18n._('weather.feelsLike'), `${current.feels_like.join('')}`)}
				${this._currentWeatherElement('mdi:water-percent', i18n._('weather.humidity'), `${current.humidity.join('')}`)}

				${this._currentWeatherElement('mdi:weather-windy', i18n._('weather.wind'), `${current.windSpeed.join('')} ${current.windDirection}`)}

				${this._currentWeatherElement('mdi:gauge', i18n._('weather.pressure'), `${current.pressure.join('')}`)}
				${this._currentWeatherElement('mdi:eye', i18n._('weather.visibility'), `${current.visibility.join('')}`)}
				${this._currentWeatherElement('mdi:white-balance-sunny', i18n._('weather.uvIndex'), `${current.uvi.join('')}`)}
				${this._currentWeatherElement('mdi:weather-cloudy', i18n._('weather.clouds'), `${current.clouds.join('')}`)}
				${this._currentWeatherElement('mdi:water-thermometer', i18n._('weather.dewPoint'), `${current.dew_point.join('')}`)}
				${this._currentWeatherElement('mdi:weather-sunset-up', i18n._('weather.sunrise'), `${current.sunrise}`)}
				${this._currentWeatherElement('mdi:weather-sunset-down', i18n._('weather.sunset'), `${current.sunset}`)}
			</div>
			<div class="weather-current-nameBlock">
				<div class="weather-current-lastUpdate">${i18n._('weather.lastUpdate')} ${current.lastUpdate}</div>
			</div>
		`;
	}

	_renderAlerts() {
		if (!this.weather_data?.alerts) return html``;

		return this.weather_data.alerts.map((alert) => {
			const iconAlertPath = this.iconManager._getWeatherAlertIcon(alert.event.awareness_level, alert.event.awareness_type);

			return html`
				<div class="alert-item">
					<div class="weather-alert-header">
						<div class="icon-container">
							<img class="weather-alerts-icons" src="${iconAlertPath}" alt="${alert.description}"/>
						</div>
						<div class="alert-header-content">
							<div class="time-row">
								<div class="time-text">
									<span>${alert.start}</span>
									<ha-icon icon="mdi:arrow-right-thin" class="arrow"></ha-icon>
									<span>${alert.end}</span>
								</div>
							</div>
							<div class="weather-alert-tags-row">
								${alert.tags.map(tag => html`<span class="tag-badge">${tag}</span>`)}
							</div>
						</div>
					</div>

					<div class="weather-alert-description">
						${alert.description}
					</div>
				</div>
			`;
		});
	}

	_renderForecast() {
		if (!this.weather_data?.dailyForecast) return html``;

		return this.weather_data.dailyForecast.map((day) => {

			return html`
				<div class="forecast-item">
					<span class="day-name">${day.dayName}</span>
					<img class="forecast-icon" src="${this.iconManager?._getWeatherIcons(day.weather)[0]}" alt="${day.name}">
					<span class="temp-range">${day.temp.min[0]} / ${day.temp.max.join('')}</span>
					<div class="extra-details">
						<div class="details-weather">
							<span>
								<ha-icon icon="mdi:weather-windy-variant"></ha-icon>
								${day.wind_speed.join('')} ${day.windDirection}
							</span>
							<span>
								<ha-icon icon="mdi:water-percent"></ha-icon>
								${day.humidity.join('')}
							</span>
							${day.rain[0] >= 1 ?
		html`<span><ha-icon icon="mdi:weather-rainy"></ha-icon>${day.rain.join('')}</span>` : ''}

							${day.snow[0] >= 1 ?
		html`<span><ha-icon icon="mdi:weather-snowy"></ha-icon>${day.snow.join('')}</span>` : ''}
						</div>
						<div class="details-day-summary">
							<div class="day-summary">${day.summary}</div>
						</div>
					</div>
				</div>
			`;
		});

	}

	render() {
		if (!this._hass || !Config.get()) return html``;
		const hide_panels = Config.get('hidePanels');

		return html`
	    <div part="kiosk-root">
			    <div class="big-weather-clock" data-theme="${this.theme}">
				    <div id="${this.#mediaContainer}"></div>

				    <!-- Middle section -->
				    <div class="middle ${classMap(this.classes['middle-noPanels'])}">
					    ${hide_panels ? '' : html`
							    <div class="left">
								    <div class="middle-left-container">
								    	${this._renderLocalSensors()}
							    	</div>
							    </div>
					    `}

					    <div class="center ${classMap(this.classes['center-noPanels'])}">
						    <div class="time-date">
							    <div class="time">
								    <div class="clock-left-side">
									    <span class="hours-minutes">${this.timeShort}</span>
									    </div>
									    <div class="clock-right-side" style="align-self:${this.showAMPM ? 'end' : 'baseline'}">
										    ${this.showSeconds ? html`
					        			<div class="seconds-container">
									        <span class="seconds">${this.seconds}</span>
					        			</div>` : ''}
										    ${this.showAMPM ? html`
								        <div class="ampm-container">
									        <span class="ampm">${this.ampm}</span>
								        </div>` : ''}
								    </div>
							    </div>
							    <div class="date">${this.dateDisplay}</div>
						    </div>

						    ${hide_panels ? '' : html`
							    <div class="current-forecast">
								    <div class="right weather-forecast">
									    <!-- Weather Forecast List -->
									    <div class="forecast-list">
										    ${this._renderForecast()}
									    </div>
								    </div>
							    </div>
						    `}
					    </div>


					    ${hide_panels ? '' : html`
						    <!-- Weather Sidebar -->
						    <div class="right">
							    	<!-- Current Weather Header -->
								    <div class="current-weather">
									    ${this._renderCurrentWeather()}
								    </div>
							    	<!-- Weather Alerts -->
							    	<div class="weather-alerts">
									    ${this._renderAlerts()}
								    </div>
						    </div>
					    `}
				    </div>
			    </div>
	    </div>
    `;
	}

}

