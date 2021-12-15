import puppeteer from 'puppeteer-core';
import fs from 'fs';


/** 
 * browserPath:  the path of the chrome executable in our pc
 * setup() :    initialize Puppeteer
 * cleanup():   clearnup Puppeteer
 * browser:     global Puppeteer browser instance
 * newPage():   get new page with default user agent and dimensions
 */

 /**
  * options: {headless, width, height}
  */
export class PuppeteerWrapper {
    constructor(logger, filePaths, options) {
        this._logger = logger;
        this._filePaths = filePaths;
        this._options = options || { headless: true };

        // Public
        this.browserPath = undefined;
        this.browser = undefined;
    }

    //#region Public API setup - cleanup

    async setup() {
        const isBrowserPathSet = await this._setBrowserPath();
        if (!isBrowserPathSet) {
            return false;
        }

        const args = [];
        if (this._options.width) {
            args.push(`--window-size=${this._options.width},${this._options.height}`);
        }

        this._logger.logInfo("Setting up puppeteer...");
        this.browser = await puppeteer.launch({
            headless: this._options.headless,
            executablePath: this.browserPath,
            args
        });
        this._logger.logInfo("Puppeteer initialized");
        return true;
    }

    async cleanup() {
        if (this.browser) await this.browser.close();
    }

    async newPage() {
        const page = await this.browser.newPage();
        page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.132 Safari/537.36');

        if (this._options.width) {
            await page._client.send('Emulation.clearDeviceMetricsOverride');
        }
        return page;
    }

    //#endregion

    //#region Helpers

    async _setBrowserPath() {
        this.browserPath = await this._getSavedPath().browser;
        if (this.browserPath) {
            if (fs.existsSync(this.browserPath)) {
                this._logger.logInfo(
                    'Executable in config file: ' + this.browserPath
                );
                return true;
            }

            // The saved path does not exists
            this._logger.logError(`Saved Chrome/Edge path does not exists: ${this.browserPath}`);
        }
        
        // Try the default path
        if (fs.existsSync(this._getDefaultOsPath().chrome)) {
          this.browserPath = this._getDefaultOsPath().chrome;
        } else if (fs.existsSync(this._getDefaultOsPath().edge)) {
          this.browserPath = this._getDefaultOsPath().edge;
        }
        
        if (!fs.existsSync(this.browserPath)) {
            this._logger.logError(`Default chrome/edge path does not exists: ${this.browserPath}`);
            this._logger.logError(`Try to set chrome/edge path in config file: ${this._filePaths.configPath()}`);
            return false;
        }

        return true;
    }

    _getSavedPath() {
        const configPath = this._filePaths.configPath();

        return new Promise((resolve, reject) => {
            if (!fs.existsSync(configPath)) {
                resolve(undefined);
                return;
            }
            fs.readFile(configPath, "utf8", (err, fileContent) => {
                if (err) {
                    this._logger.logError(err);
                    reject();
                    return;
                }

                resolve(JSON.parse(fileContent));
            });
        })
    }

    _getDefaultOsPath() {
        if (process.platform === "win32") {
            // return 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
            // return 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
            return {
                chrome: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                edge: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            };
        } else {
            return { chrome: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'};
        }
    }

    //#endregion
}