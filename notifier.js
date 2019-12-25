const Twit              = require('twit');
const GoogleSpreadsheet = require('google-spreadsheet');

const { promisify }     = require('util');

const creds             = require('./client_secret.json');
const keys              = require('./keys.env');


var robot = new Twit(keys);

/* your configurations */
const spreadsheetID = '1yDaTcGnOUEd_EJNlpPdmYWkUPLZFYJZ6aRgDeL5mapI';

main();

/* setInterval(getReadyDesigns, 30000); */

function main() {

    getReadyDesigns();    

}

async function getMsg() {
    
    const doc = new GoogleSpreadsheet(spreadsheetID);
    await promisify(doc.useServiceAccountAuth)(creds);

    const info = await promisify(doc.getInfo)();
    const sheet = info.worksheets[2];

    let rows = await promisify(sheet.getRows)();

    let randomIndex = Math.floor(Math.random() * rows.length);

    return rows[randomIndex].custommessage;
}

async function getReadyDesigns() {    

    const doc = new GoogleSpreadsheet(spreadsheetID);
    await promisify(doc.useServiceAccountAuth)(creds);

    const info = await promisify(doc.getInfo)();
    const sheet = info.worksheets[0];

    let rows = await promisify(sheet.getRows)({
        query: 'isready = TRUE'
    });

    rows.forEach(function(item) {      
        if(item.isnotified == 'FALSE') {           
            tweetReply(item);
            item.isnotified = 'TRUE';
            item.save();
        }
    });
}

async function tweetReply(item) {

    let msg = await getMsg();

    let text = `${msg} ${item.designlink}`;
    let reply_to_handle = item.tweethandle;
    let reply_thread_id = item.tweetid;

    let composedTweet = {
        status: `${reply_to_handle} ${text}`,
        in_reply_to_status_id: reply_thread_id
    }

    robot.post('statuses/update', composedTweet, function(error, reply) {
        let time = timestamp();
        
        if(error) {
            console.log(`${time} ${error.message}`);
        } else {
            console.log(`${time} Tweeted ${reply_to_handle}`);
        }
    });
}

function timestamp() {
    let time = new Date().toLocaleTimeString('en-US', {hour12: false, hour: 'numeric', minute: 'numeric', second: 'numeric'});
    time = `[${time}]`;

    return time;
}
