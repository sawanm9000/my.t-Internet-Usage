import os from 'os';
import fs from 'fs';
import path from 'path';

export class FilePaths {
    constructor(logger, appFolderName) {
        if (!appFolderName) throw new Error('FilePaths: application folder name not specified');
        this.appFolderName = appFolderName;

        const appFolderPath = this.appFolderPath();
        if (!fs.existsSync(appFolderPath)) {
            try {
                fs.mkdirSync(appFolderPath);
            } catch(e) {
                logger.logError(`Error while creating directory ${appFolderPath} \n ${e}`);
            }
            
            logger.logInfo(`Created folder ${appFolderPath}`);
        } else {
            logger.logInfo(`Using folder ${appFolderPath}`);
        }
    }

    appFolderPath() {
        const documentsPath = path.join(os.homedir(), "Documents");

        return path.join(documentsPath, this.appFolderName);
    }

    dbFilePath() {
        return path.join(this.appFolderPath(), 'db.json');
    }

    // credentialsFilePath() {
    //     return path.join(this.appFolderPath(), 'credentials.json');
    // }

    configPath() {
        return path.join(this.appFolderPath(), 'config.json');
    }

    logsPath() {
        return path.join(this.appFolderPath(), 'logs.txt');
    }
}