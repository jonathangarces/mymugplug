
const Twit = require('twit');
const GoogleSpreadsheet = require('google-spreadsheet');
const nodemailer = require('nodemailer');
const { promisify } = require('util');
const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;;

const creds = require('./client_secret.json');
const keys = require('./keys.env');
const email = require('./email_secret.env');


var robot = new Twit(keys);
var mailer = nodemailer.createTransport(email);

/* your configurations */
const twitterHandle = '@mymugplug';
const adminEmail = 'mymugplug@gmail.com';
const spreadsheetID = '1yDaTcGnOUEd_EJNlpPdmYWkUPLZFYJZ6aRgDeL5mapI';

const WooCommerce = new WooCommerceRestApi({
    url: "https://mymugplug.com",
    consumerKey: "ck_ee9c639103a453e494bb625c07d5497cd849379a",
    consumerSecret: "cs_d48338b601ec9db9ecf7d5638d33048f0bf343f0",
    version: "wc/v3"
});

main();

function main() {
    // begin
    console.log(`${timestamp()} The bot is now listening to mentions ${twitterHandle}`);
    var stream = robot.stream('statuses/filter', { track: twitterHandle });
    stream.on('tweet', addData);

}

async function addData(tweet) {

    const data = {
        name: "Custom Mug Design For " + tweet.user.screen_name,
        type: "simple",
        regular_price: "15.99",
        description: tweet.user.url,
        short_description: "hello",
        categories: [
            {
                id: 21
            }

        ],
        images: [
            {
                src: "https://cdn.shopify.com/s/files/1/0124/9152/2106/products/Scalzi_Tweet_Mug_1024x1024.png?v=1553496742"

            },
            {
                src: "https://cdn.shopify.com/s/files/1/0124/9152/2106/products/All_my_Ss_1024x1024.jpg?v=1553496742"
            }
        ]
    };
    var permalink;
    await WooCommerce.post("products", data)
        .then((response) => {
            //console.log("Response Data:", response.data);
            permalink = response.data.permalink

        })
        .catch((error) => {
            console.log('errror', error);
        });

    if (tweet.in_reply_to_status_id_str == null) {
        return console.log(`${timestamp()} tweet without parent. [@${tweet.user.screen_name}]`);
    }
    if (tweet.in_reply_to_screen_name == twitterHandle) {
        return console.log(`${timestamp()} ignoring replies to the bot. [@${tweet.user.screen_name}]`);
    }
    if (tweet.in_reply_to_screen_name == tweet.user.screen_name) {
        return console.log(`${timestamp()} ignoring replies to the bot. [@${tweet.user.screen_name}]`);
    }

    let tweet_url = makeTweetUrl(tweet.user.screen_name, tweet.id_str);
    let parent_tweet_url = makeTweetUrl(tweet.in_reply_to_screen_name, tweet.in_reply_to_status_id_str);

    let time = new Date().toLocaleTimeString('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour12: false,
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric'
    });


    newRow = {
        date: time,
        tweet_handle: `@${tweet.user.screen_name}`,
        tweet_id: tweet.id_str,
        tweet_url: tweet_url,

        parent_tweet_handle: `@${tweet.in_reply_to_screen_name}`,
        parent_tweet_id: tweet.in_reply_to_status_id_str,
        parent_tweet_url: parent_tweet_url,

        design_link: permalink,
        is_ready:true,
        is_notified: false
    }

    const doc = new GoogleSpreadsheet(spreadsheetID);
    await promisify(doc.useServiceAccountAuth)(creds);

    const info = await promisify(doc.getInfo)();
    const sheet = info.worksheets[0];

    await promisify(sheet.addRow)(newRow);

    console.log(`${timestamp()} added data to the spreadsheet. [@${tweet.user.screen_name}]`);

    tweetReply(newRow);
    console.log('repply', newRow)
    sendEmail(newRow); console.log('sendemail', newRow)
}



function makeTweetUrl(screen_name, status_id) {
    return `https://www.twitter.com/${screen_name}/status/${status_id}`;
}

function sendEmail(data) {

    let subject = `<h1>Your bot was mentioned on Twitter by ${data.tweet_handle}!</h1>`;
    let original_tweet = `<p>Link for the original tweet: <a target="_blank" rel="noopener noreferrer" href="${data.parent_tweet_url}">${data.parent_tweet_url}</a></p>`;
    let customer_tweet = `<p>Link for the reply tweet: <a target="_blank" rel="noopener noreferrer" href="${data.tweet_url}">${data.tweet_url}</a></p>`;
    let spreadsheets = `<p>You can access your spreadsheet with all the data <a target="_blank" rel="noopener noreferrer" href="https://docs.google.com/spreadsheets/d/${spreadsheetID}/">here</a>.</p>`;

    let body_message = subject + original_tweet + customer_tweet + spreadsheets;

    let mailOptions = {
        from: email.auth.user,
        to: adminEmail,
        subject: `Your bot was mentioned on Twitter by ${data.tweet_handle}!`,
        html: body_message
    }

    mailer.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(`${timestamp()} ${error}`);
        } else {
            console.log(`${timestamp()} a notification e-mail was sent`);
        }
    });

}

async function getMsg() {

    const doc = new GoogleSpreadsheet(spreadsheetID);
    await promisify(doc.useServiceAccountAuth)(creds);

    const info = await promisify(doc.getInfo)();
    const sheet = info.worksheets[1];

    let rows = await promisify(sheet.getRows)();

    let randomIndex = Math.floor(Math.random() * rows.length);

    return rows[randomIndex].custommessage;
}

async function tweetReply(item) {

    let msg = await getMsg();

    let text = `${msg}`;
    let reply_to_handle = item.tweet_handle;
    let reply_thread_id = item.tweet_id;

    let composedTweet = {
        status: `${reply_to_handle} ${text}`,
        in_reply_to_status_id: reply_thread_id
    }

    robot.post('statuses/update', composedTweet, function (error, reply) {
        let time = timestamp();

        if (error) {
            console.log(`${time} ${error.message}`);
        } else {
            console.log(`${time} Tweeted ${reply_to_handle}`);
        }
    });
}


function timestamp() {
    let time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: 'numeric', minute: 'numeric', second: 'numeric' });
    time = `[${time}]`;
    return time;
}
