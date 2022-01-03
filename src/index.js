//#region Imports
// Library ----------------------------------------------------------------------------------
const electron = require('electron');

window.jQuery = require('jquery');
window.$ = window.jQuery;
const tableToJson = require('tabletojson').Tabletojson;

import { Logger } from './lib/logger';
import { FilePaths } from './lib/file-paths.js';
import { PuppeteerWrapper } from './lib/puppeteer-wrapper';
import fs from 'fs';

import regression from 'regression';

const Plotly = require('plotly.js');


//#endregion

//#region Setup - Dependency Injection-----------------------------------------------
const _logger = new Logger();
const _filePaths = new FilePaths(_logger, 'Internet Usage');
const _puppeteerWrapper = new PuppeteerWrapper(_logger, _filePaths, {
	headless: true, // ! Headless
	width: 1366,
	height: 700,
});

//#endregion

//#region Main ----------------------------------------------------------------------

const chart = document.getElementById('chart');

const trendLineAvg = 5; // Number of past days to average

let currentMonthDisplayed = new Date();

async function setCurrentMonth(date) {
  if (date) {
    currentMonthDisplayed = date;
  } else {
    currentMonthDisplayed = new Date();
  }
  
  const month = currentMonthDisplayed.getMonth();
  const year = currentMonthDisplayed.getFullYear();
  $('.current-month').text(getMonthText(month) + ' ' + year)

  if (month !== new Date().getMonth() || year !== new Date().getFullYear()) {
    $('.info-box').hide();
  } else {
    $('.info-box').show();
  }
}

function getMonthText(monthNum) {
  switch (monthNum) {
    case 0: return 'January';
    case 1: return 'February';
    case 2: return 'March';
    case 3: return 'April';
    case 4: return 'May';
    case 5: return 'June';
    case 6: return 'July';
    case 7: return 'August';
    case 8: return 'September';
    case 9: return 'October';
    case 10: return 'November';
    case 11: return 'December';
  }
}

$(document).keypress(function (event) {
	if (event.which === 96) {
		$('.logger-container').toggle();
		event.preventDefault();
	}
});

$(document).on('keyup', function(e) {
  if (e.key == "Escape") {
    $('.cancel').click();
    if ($('.logger-container').length) {
      $('.logger-container').hide();
    }
  }
});

$('.show-log-btn').on('click', (e) => {
  e.preventDefault();
  $('.app-info-container').hide();
  $('.logger-container').css('display', 'flex');
})

$('.homepage-btn').on('click', function(event) {
  event.preventDefault();
  electron.shell.openExternal('https://github.com/sawanm9000/my.t-Internet-Usage');
});

async function createConfigFile(userId, password, cap, browser) {
	fs.writeFile(_filePaths.configPath(), JSON.stringify({userId, password, cap, browser}), 'utf8', async err => {
    if (err) { 
      _logger.logInfo(err);
      return;
    } else {
      _logger.logInfo('Settings saved to ' + _filePaths.configPath());
      await createDatabase();
    }
  });
}

async function createDatabase() {
  fs.readFile(_filePaths.dbFilePath(), 'utf8', async function (err, data) {
		if (err) {
			_logger.logInfo('No database');
			_logger.logInfo('Creating database at ' + _filePaths.dbFilePath());
			_logger.logError(err);
			fs.writeFile(_filePaths.dbFilePath(), JSON.stringify([]), 'utf8', (err) => {
				if (err) _logger.logInfo(err);
			});
      $('.logger-container').css('display', 'flex');
      await initDataFetching(currentMonthDisplayed);
		} else {
      let dataSet = JSON.parse(data);
			if (dataSet[0]) {
        _logger.logInfo('Database already present at ' + _filePaths.dbFilePath());
			}
		}
  });
}

$('.btn-previous').click(async () => {
	const previousMonth = new Date(currentMonthDisplayed.getFullYear(), currentMonthDisplayed.getMonth() - 1, 1)
	await setCurrentMonth(previousMonth);
  const chartUpdate = {
		'xaxis.range': [
			firstLastDatesOfMonth(currentMonthDisplayed, 'ymd').firstDate,
			firstLastDatesOfMonth(currentMonthDisplayed, 'ymd').lastDate,
		],
  };
  Plotly.relayout(chart, chartUpdate);
})

$('.btn-next').click(async () => {
	const nextMonth = new Date(currentMonthDisplayed.getFullYear(), currentMonthDisplayed.getMonth() + 1, 1)
	await setCurrentMonth(nextMonth);
  const chartUpdate = {
		'xaxis.range': [
			firstLastDatesOfMonth(currentMonthDisplayed, 'ymd').firstDate,
			firstLastDatesOfMonth(currentMonthDisplayed, 'ymd').lastDate,
		],
  };
  Plotly.relayout(chart, chartUpdate);
})

$('.current-month').click(async () => {
  const currentMonth = new Date();
  await setCurrentMonth(currentMonth);
  const chartUpdate = {
		'xaxis.range': [
			firstLastDatesOfMonth(currentMonthDisplayed, 'ymd').firstDate,
			firstLastDatesOfMonth(currentMonthDisplayed, 'ymd').lastDate,
		],
  };
  Plotly.relayout(chart, chartUpdate);
})

$('#config-form').submit(async function(event) {
  event.preventDefault();
  if($('#userId').val() && $('#password').val() && $('#cap').val() && $('#browser').val()) {
    const userId = $('#userId').val();
    const password = $('#password').val();
    const cap = $('#cap').val();
    const browser = $('#browser').val();
    await createConfigFile(userId, password, cap, browser);
    $('.config-container').hide();
  };
})

$('.btn-fetch').click(async () => {
  if ($('.spin')[0]) return;
	$('.logger-container').css('display', 'flex');
  if (!credentials.userId) {
    try {
      await setCredentials();
    } catch (error) {
      _logger.logInfo(error)
    }
  }
  
  try {
    await fetchUsageData(credentials.userId, credentials.password, currentMonthDisplayed);
    await plotDataToChart(currentMonthDisplayed);
    _logger.logInfo('Finished');
  } catch (error) {
    _logger.logError(error);
  }
})

$('.btn-info').click(() => {
  $('.app-info-container').css('display', 'flex');
})

$('.app-info-container').click(() => {
  $('.app-info-container').hide()
});

function loadConfig() {
  fs.readFile(_filePaths.configPath(), 'utf8', (err, data) => {
		if (err) _logger.logError(err);
		else {
			const parsedData = JSON.parse(data);

			$('#userId').val(parsedData.userId);
			$('#password').val(parsedData.password);
			$('#cap').val(parsedData.cap);
			$('#browser').val(parsedData.browser);
		}
  });
}

$('.btn-settings').click(() => {
  $('.config-container').css('display', 'flex');
  loadConfig();
});

$('#close-settings').click(() => {
	$('.config-container').hide();
});


let config = '';
const credentials = {
  userId: '',
  password: '',
  cap: ''
}

async function setCredentials() {
  try {
    config = fs.readFileSync(_filePaths.configPath(), 'utf8');
    const configData = JSON.parse(config);
    credentials.userId = configData['userId'];
    credentials.password = configData['password'];
    credentials.cap = parseInt(configData['cap']);
    _logger.logInfo('Credentials set');
  } catch (error) {
    _logger.logError(error);
  }
}

async function initDataFetching(month) {
  let maxRetries = 5;

  for (let retries = 1; retries <= maxRetries; retries++) {
    try {
      if (!credentials.userId) await setCredentials();
      if (credentials.userId) {
        const chromeSet = await _puppeteerWrapper.setup();
        if (!chromeSet) {
          return;
        }
        await fetchUsageData(credentials.userId, credentials.password, month);
        await plotDataToChart(month);
        break;
      } else {
        _logger.logInfo('There is a problem with the credentials');
        $('.logger-container').hide();
        $('.config-container').css('display', 'flex');
        loadConfig();
      }
    } catch (e) {
      if (retries <= maxRetries) {
        _logger.logInfo('Retrying... (attempt ' + retries + ' of ' + maxRetries + ')');
        continue;
      } else {
        _logger.logError('Error:');
        _logger.logError(e);
        throw e;
      }
    } finally {
      await _puppeteerWrapper.cleanup();
    }
  }
}

async function fetchUsageData(userIdVal, passwordVal, month) {
  $('#reload').addClass('spin');
  const chromeSet = await _puppeteerWrapper.setup();
  if (!chromeSet) {
		return;
  }
	const page = await _puppeteerWrapper.newPage();
	await page.setDefaultNavigationTimeout(120000);

  _logger.logInfo('Fetching data. Please wait...');

	await page.goto('https://internetaccount.myt.mu/');

	const userId = '#id2';
	const password =
		'.loginarea > tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(2) > input:nth-child(1)';
	const signInBtn = '#id5';
  const remainingVolumeBank = '#id22 > table > tbody > tr:nth-child(2) > td > table > tbody > tr:nth-child(6) > td:nth-child(2) > div > font > span > label';
	const sessionReport = '#accordion > li:nth-child(2) > div > a';
	const sessionReport2 = '#accordion > li:nth-child(2) > ul > li > a';
	const fromDate = '#id37';
	const toDate = '#id38';
	const submit = '#id3c';
	const showingEntries = '#id51';
	const table = '#id71 > table.dataTable';
	const lastRow = '#id76';
	const logOff = '#id5c';

	await page.waitForSelector(userId);
	await page.waitForSelector(password);
	await page.waitForTimeout(500);
	await page.click(userId); 

  await page.keyboard.type(userIdVal);
	await page.click(password);
	await page.keyboard.type(passwordVal);
	await page.click(signInBtn);
	// await page.waitForTimeout(5000);
	// await page.waitForNavigation();

  await page.waitForSelector(remainingVolumeBank);
  const element = await page.$(remainingVolumeBank);
  let value = await page.evaluate(el => el.textContent, element);
  value = parseFloat(value);
  $('.remaining-volume').text(+(value / 1000).toFixed(2) + 'GB');

	await page.waitForSelector(sessionReport);
	await page.click(sessionReport);
	await page.waitForSelector(sessionReport2);
	// await page.waitForTimeout(5000);
	// await page.waitForNavigation();
	await page.click(sessionReport2);
	await page.waitForSelector(fromDate);
	await page.waitForTimeout(2000);
	await page.click(fromDate);
  
	// await page.waitForSelector(cal1);
	// await page.waitForTimeout(300);
	// await page.waitForSelector('#id37DpJs_cell0');
	// await page.waitForTimeout(300);
  
	await page.waitForTimeout(200);
	await page.keyboard.type(firstLastDatesOfMonth(month, 'dmy').firstDate);

	await page.click(toDate);
	await page.keyboard.type(firstLastDatesOfMonth(month, 'dmy').lastDate);
	await page.click(submit);
	await page.waitForSelector(showingEntries);
	await page.waitForTimeout(200);
	await page.click(showingEntries);
	await page.waitForTimeout(100);
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Enter');
	await page.waitForTimeout(1000);
	await page.waitForSelector(table);
	await page.waitForSelector(lastRow);
	await page.waitForTimeout(1000);

	let tableHTML = await page.$eval('table.dataTable', (el) => el.innerHTML);
	const tableHTMLNode = $('<table>' + tableHTML + '</table>');
	tableHTMLNode.find('tr').eq(-1).remove();

	const HTMLTable = '<table>' + tableHTMLNode.html() + '</table>';

	const tableJSON = tableToJson.convert(HTMLTable);
	// Data cleanup
	for (let i = 0; i < tableJSON[0].length; i++) {
		delete tableJSON[0][i]['IP  Address'];
		delete tableJSON[0][i]['Uploaded Volume'];
		delete tableJSON[0][i].Charge;

		tableJSON[0][i]['Time Online'] = tableJSON[0][i]['Time OnlineCall Duration'];
		delete tableJSON[0][i]['Time OnlineCall Duration'];
	}

	let thisTimeInDataSet = "";

	fs.readFile(_filePaths.dbFilePath(), 'utf8', (err, data) => {
		if (err) {
			_logger.logInfo(err);
		} else {
			let dataSet = JSON.parse(data); // now it's an object

			for (let i = 0; i < dataSet.length; i++) {
				if (
					new Date(dataSet[i][0]['Date']).getTime() ===
					new Date(new Date().getFullYear(), new Date().getMonth(), 0).getTime()
				) {
					thisTimeInDataSet = dataSet[i][0]['Date'];
					break;
				}
			}

      if (thisTimeInDataSet) {
        // Find dataset block to push to
        for (let i = 0; i < dataSet.length; i++) {
          if (dataSet[i][0]['Date'] === thisTimeInDataSet) {
            dataSet[i] = [];
            dataSet[i] = [...tableJSON[0]]
            break;
          }
        }
      } else {
        dataSet.push(tableJSON[0]); // add data
      }

			const json = JSON.stringify(dataSet); // convert it back to json
			fs.writeFile(_filePaths.dbFilePath(), json, 'utf8', (err) => {
				if (err) _logger.logInfo(err);
			});
		}
	});

	await page.waitForTimeout(1000);

	await page.click(logOff);
	await page.waitForNavigation();
  $('#reload').removeClass('spin');
  await _puppeteerWrapper.cleanup();
}

function firstLastDatesOfMonth(date, format) {
  const dateOfMonth = new Date(date);

  const firstDate = new Date(dateOfMonth.getFullYear(), dateOfMonth.getMonth(), 1);
  const thisMonth = firstDate.getMonth();
  const thisYear = firstDate.getFullYear();

  const lastDateOfMonth = new Date(
		dateOfMonth.getFullYear(),
		dateOfMonth.getMonth(),
		new Date( dateOfMonth.getFullYear(), dateOfMonth.getMonth() + 1, 0 ).getDate()
  );
  const thisMonthLast = lastDateOfMonth.getMonth();
  const thisYearLast = lastDateOfMonth.getFullYear();

  if (format === 'dmy') {
    return {
      firstDate: `01/${thisMonth + 1}/${thisYear}`,
      lastDate: `${lastDateOfMonth.getDate()}/${ thisMonthLast + 1 }/${thisYearLast}`,
    };
  } else if (format === 'ymd') {
    return {
      firstDate: `${thisYear}-${thisMonth + 1}-01`,
      lastDate: `${thisYearLast}-${ thisMonthLast + 1 }-${lastDateOfMonth.getDate()}`,
    };
  } else {
    _logger.logError('Format error');
  }
}

let dataToPlot = [
  {
    type: 'bar',
    offset: 0,
    x: [],
    y: [],
    width: [],
  },
  {
    mode: 'markers',
    marker: { color: 'rgb(200, 200, 200)' },
    offset: 0,
    x: [],
    y: [],
  },
  {
    mode: 'lines',
    line: {
      color: 'rgb(128, 128, 128)',
      dash: 'dash'
    },
    x: [],
    y: []
  }
];

let trendLineData = [];

function plotTrendLine() {
  const lastDateInDataset = new Date(dataToPlot[0].x[dataToPlot[0].x.length - 1]);
  if (lastDateInDataset.getDate() === 1) return;

  const thisMonth = new Date();
  if (lastDateInDataset.getMonth() !== thisMonth.getMonth()) return;

  dataToPlot[1].x = [];
  dataToPlot[1].y = [];

  // Populate dataToPlot markers for trendLine
  for (let i = dataToPlot[0].x.length - 1; i >= dataToPlot[0].x.length - trendLineAvg && i > 0 && new Date(dataToPlot[0].x[i]).getMonth() === new Date().getMonth(); i--) {

    const toPushX = new Date(dataToPlot[0].x[i]).getTime();
    const xTime = toPushX + (dataToPlot[0].width[i] / 2);

    const year = new Date(xTime).getFullYear();
    const month = new Date(xTime).getMonth() + 1;
    const date = new Date(xTime).getDate();
    const hour = new Date(xTime).getHours();
    const minute = new Date(xTime).getMinutes();
    const second = new Date(xTime).getSeconds();

    dataToPlot[1].x.push(`${year}-${month}-${date} ${hour}:${minute < 10 ? '0' + minute : minute}:${second < 10 ? '0' + second : second}`);
    dataToPlot[1].y.push(dataToPlot[0].y[i]);
  }

  trendLineData = [];

  // Populate trendLineData: []
  for (let i = 0; i < dataToPlot[1].x.length; i++) {
    const xCoord = new Date(dataToPlot[1].x[i]).getTime();
    const yCoord = +dataToPlot[1].y[i].toFixed(2);
    trendLineData.push([xCoord, yCoord]);
  }
  
  trendLineData.reverse();

  const result = regression.linear(trendLineData, {precision: 13});
  const gradient = result.equation[0];
  const yIntercept = result.equation[1];
  const firstDate = trendLineData[0][0];
  const valAtFirstDate = gradient * firstDate + yIntercept;

  const secondDate = -yIntercept / gradient;
  const valAtSecondDate = 0;
  
  dataToPlot[2].x = [];
  dataToPlot[2].y = [];
  
  dataToPlot[2].x.push(Math.round(firstDate));
  dataToPlot[2].x.push(Math.round(secondDate));
  dataToPlot[2].y.push(valAtFirstDate);
  dataToPlot[2].y.push(valAtSecondDate);

  const date = new Date(Math.round(secondDate)).getDate();
  const month = new Date(Math.round(secondDate)).getMonth();
  const year = new Date(Math.round(secondDate)).getFullYear();

  $('.exhaustion-date').text(`${date} ${getMonthText(month)} ${year}`)
}

async function plotDataToChart(month) {
  fs.readFile(_filePaths.dbFilePath(), 'utf8', (err, data) => {
		if (err) {
			_logger.logInfo(err);
		} else {
			let dataSet = JSON.parse(data); // now it's an object

			const flattened = [].concat.apply([], dataSet);

      const pastVal = flattened.slice(flattened.length - trendLineAvg, flattened.length)
      const sumOfPastVal = pastVal.reduce((total, downVol) => {
        return total + parseFloat(downVol['Downloaded Volume']);
      }, 0)

      const averageOfPastVal = sumOfPastVal / trendLineAvg;
      $('.down-rate-val').text(+(averageOfPastVal / 1024 / 1024).toFixed(2))


			let remainingVolume = credentials.cap;

      // Populate dataToPlot[0]
      dataToPlot[0].x = [];
      dataToPlot[0].y = [];
			for (let i = 0; i < flattened.length; i++) {
				const date = new Date(flattened[i]['Date']);
				const toPushX = `${date.getFullYear()}-${ date.getMonth() + 1 }-${date.getDate()} ${flattened[i]['From']}`;
				dataToPlot[0]['x'].push(toPushX);

				if (date.getDate() === 1) {
					remainingVolume = credentials.cap;
        } 
        
        dataToPlot[0]['y'].push( remainingVolume - parseInt(flattened[i]['Total Volume(KB)']) / 1024 / 1024 );
        remainingVolume -= parseInt(flattened[i]['Total Volume(KB)']) / 1024 / 1024;

				const timeOnlineToMinutesArr = flattened[i]['Time Online'].split(':');
				dataToPlot[0]['width'].push( (parseInt(timeOnlineToMinutesArr[0]) * 60 + parseInt(timeOnlineToMinutesArr[1])) * 60 * 1000 - 2880000 );
			}

      plotTrendLine();
      
		}

		const layout = {
			font: {
				color: '#fff',
			},
			paper_bgcolor: '#000',
			plot_bgcolor: '#000',
			margin: {
				l: 27,
				r: 5,
				b: 38,
				t: 5,
				pad: 3,
			},
			automargin: true,
			xaxis: {
				gridcolor: '#333',
				// tickangle: 45,
				range: [firstLastDatesOfMonth(month, 'ymd').firstDate, firstLastDatesOfMonth(month, 'ymd').lastDate],
				dtick: 86400000,
				tickformat: '%e\n%B %Y',
			},
			yaxis: {
				gridcolor: '#333',
				dtick: credentials.cap <= 300 ? 10 : credentials.cap < 10000 ? 100 : 500,
				rangemode: 'nonnegative',
				range: [0, credentials.cap],
				fixedrange: true,
			},
			showlegend: false,
			dragmode: 'pan',
		};

		const config = {
			responsive: true,
			displayModeBar: false
		};

		Plotly.newPlot(chart, dataToPlot, layout, config);

    $('.logger-container').hide();
  });
}

// At launch
(async () => {
  await setCurrentMonth();
  // currentMonthDisplayed = new Date();
  await plotDataToChart(currentMonthDisplayed);
  await setCredentials();
	await initDataFetching(currentMonthDisplayed);

	_logger.logInfo('Finished fetching!');

	await _logger.exportLogs(_filePaths.logsPath());

})();

//#endregion
