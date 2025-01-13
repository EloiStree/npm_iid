// Required modules
// npm install ntp-client ws
// npm install buffer
// npm install node-fetch
//https://stackoverflow.com/questions/19059580/browser-uncaught-referenceerror-require-is-not-defined






// const { Buffer } = require('buffer');  // Buffer polyfill for browser
// const fetch = require('node-fetch');  // Fetch polyfill for browser

// WebSocket is natively supported in browsers, no need for 'ws' import

// ntp-client replacement (example using worldtimeapi)






// Utility class for handling byte manipulations
class IIDUtility {
    static defaultGlobalNtpOffsetInMilliseconds = 0;

    static isTextIpv4(serverName) {
        const pattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
        return pattern.test(serverName);
    }

    static async getIpv4(serverName) {
        if (this.isTextIpv4(serverName)) {
            return serverName;
        }
        const response = await fetch(`https://dns.google/resolve?name=${serverName}`);
        const data = await response.json();
        return data?.Answer?.[0]?.data;  // Example way to extract IPv4
    }

    static getDefaultGlobalNtpOffsetInMilliseconds() {
        return this.defaultGlobalNtpOffsetInMilliseconds;
    }

    

    static bytesToInt(buffer) {
        return buffer.readInt32LE(0);
    }

    static bytesToIndexInteger(buffer) {
        return {
            index: buffer.readInt32LE(0),
            value: buffer.readInt32LE(4),
        };
    }

    static bytesToIndexDate(buffer) {
        return {
            index: buffer.readInt32LE(0),
            date: buffer.readBigUInt64LE(4),
        };
    }

    static bytesToIndexIntegerDate(buffer) {
        return {
            index: buffer.readInt32LE(0),
            value: buffer.readInt32LE(4),
            date: buffer.readBigUInt64LE(8),
        };
    }
    static indexIntegerDateToBytes(index, value, date) {
        const indexBytes = new Uint8Array(new Int32Array([index]).buffer);
        const valueBytes = new Uint8Array(new Int32Array([value]).buffer);
        const dateBytes = new Uint8Array(new BigUint64Array([BigInt(date)]).buffer);
        const combined = new Uint8Array(16);
        combined.set(indexBytes, 0);
        combined.set(valueBytes, 4);
        combined.set(dateBytes, 8);
        return combined;
    }
    static integerToBytes(value) {
        const buffer = new ArrayBuffer(4);
        const view = new DataView(buffer);
        view.setInt32(0, value, true);
        return new Uint8Array(buffer);
    }

    static indexIntegerToBytes(index, value) {
        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);
        view.setInt32(0, index, true);
        view.setInt32(4, value, true);
        return new Uint8Array(buffer);
    }

    static indexIntegerDateToBytes(index, value, intTimestamp) {
        const buffer = new ArrayBuffer(16);
        const view = new DataView(buffer);
        view.setInt32(0, index, true);
        view.setInt32(4, value, true);
        view.setBigUint64(8, BigInt(intTimestamp), true);
        return new Uint8Array(buffer);
    }

    static indexIntegerNowRelayMillisecondsToBytes(index, value, delayInMilliseconds) {
        var adjustedTimeMilliseconds = this.getDateTimeNowNtpMsUTC();
        adjustedTimeMilliseconds += delayInMilliseconds;
        console.log(`IID: ${index}, ${value}, ${adjustedTimeMilliseconds}`);
        console.log(`Secnonds: ${adjustedTimeMilliseconds/1000}`);
        return this.indexIntegerDateToBytes(index, value, adjustedTimeMilliseconds);
    }

    static textShortcutToBytes(text) {
        try {
            if (text.startsWith("i:")) {
                const integer = parseInt(text.split(":")[1]);
                return this.integerToBytes(integer);
            } else if (text.startsWith("ii:")) {
                const [index, integer] = text.split(":")[1].split(",").map(Number);
                return this.indexIntegerToBytes(index, integer);
            } else if (text.startsWith("iid:")) {
                const [index, integer, delay] = text.split(":")[1].split(",").map(Number);
                return this.indexIntegerNowRelayMillisecondsToBytes(index, integer, delay);
            } else {
                text = text.replace(/\s+/g, " ").trim();
                const tokens = text.split(/,| /).map(Number);
                if (tokens.length === 1) {
                    return this.integerToBytes(tokens[0]);
                } else if (tokens.length === 2) {
                    return this.indexIntegerToBytes(tokens[0], tokens[1]);
                } else if (tokens.length === 3) {
                    return this.indexIntegerNowRelayMillisecondsToBytes(tokens[0], tokens[1], tokens[2]);
                } else {
                    return this.integerToBytes(parseInt(text));
                }
            }
        } catch (error) {
            console.error("Error", error);
        }
        return null;
    }

    static getRandomInteger(fromValue, toValue) {
        return Math.floor(Math.random() * (toValue - fromValue + 1)) + fromValue;
    }

    static getRandomInteger100() {
        return this.getRandomInteger(0, 100);
    }

    static getRandomIntegerIntMax() {
        return this.getRandomInteger(-2147483647, 2147483647);
    }

    static getRandomIntegerIntMaxPositive() {
        return this.getRandomInteger(0, 2147483647);
    }

    static i(integerValue) {
        return this.integerToBytes(integerValue);
    }

    static ii(index, integerValue) {
        return this.indexIntegerToBytes(index, integerValue);
    }

    static iid(index, integerValue, date) {
        return this.indexIntegerDateToBytes(index, integerValue, date);
    }

    static iidMs(index, integerValue, milliseconds) {
        return this.indexIntegerDateToBytes(index, integerValue, milliseconds);
    }

   
    // Fetch Unix time from the WorldTimeAPI
    static async getUnixTime() {
        while (true) {
            
            try {
                const response = await fetch('http://worldtimeapi.org/api/timezone/Etc/UTC');
                const data = await response.json();
                console.log('Unix Time from WorldTimeAPI:', data.unixtime);
                return data.unixtime; // Unix time in seconds
            } catch (error) {
                console.error('Error fetching time:', error);
            }
            await new Promise(resolve => setTimeout(resolve, 3000));  // Retry every second
        }
    }
    static async offsetMsNtpIsDefined(){

        if(this.defaultGlobalNtpOffsetInMilliseconds === 0){
            return false;
        }
        return true;
    }

    // Get current time in milliseconds (UTC)
    static getDateTimeNowMsUTC() {
        return Date.now();
    }

    // Get current time with NTP offset in milliseconds (UTC)
    static getDateTimeNowNtpMsUTC() {
        return this.getDateTimeNowMsUTC() + this.defaultGlobalNtpOffsetInMilliseconds;
    }

    // Update global NTP offset by comparing local time with WorldTimeAPI

   

    static async coroutineUpdateTimestamps() {
        try {
            const unixTime = await IIDUtility.getUnixTime();
            if (unixTime === null) {
                console.error('Failed to fetch Unix time. Cannot update timestamps.');
                return;
            }

            console.log('Unix Time:', unixTime);

            // Get current timestamp on the computer
            const currentTime = this.getDateTimeNowMsUTC();
            
            // Calculate the offset in milliseconds
            const offsetMilliseconds = currentTime - unixTime * 1000; // Convert unixTime (seconds) to milliseconds
            this.defaultGlobalNtpOffsetInMilliseconds = offsetMilliseconds;
            
            console.log('Offset in milliseconds:', offsetMilliseconds);
        } catch (error) {
            console.error('Error updating timestamps:', error);
        }
    }
}

// WebSocket connection handling class
class IIDWebSocketConnection {
    constructor(url) {
        this.url = url;
        this.connect();
    }

    
      

    sendInteger(value) {
        const buffer = IIDUtility.integerToBytes(value);
        this.ws.send(buffer);
    }

    isWebSocketConnected() {
        return this.ws.readyState === WebSocket.OPEN;
    }

    connect() {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            console.log('Connected to WebSocket server');
        };

        this.ws.onmessage = (event) => {
            const data = event.data;
            console.log('Received:', data);
            // Handle different byte length cases
            if (data.byteLength === 4) {
                console.log('Received I:', IIDUtility.bytesToInt(data));
            } 
        };

        this.ws.onclose = () => {
            console.log('Disconnected from WebSocket server');
            setTimeout(() => this.connect(), 4000);  // Auto-reconnect after 4 seconds
        };

        this.ws.onerror = (err) => {
            console.error('WebSocket error:', err);
        };
    }
}



// Example WebSocket usage with random integers
class CodeDemoPingRandomIntegerNow {
    constructor() {

        const wsManager = new IIDWebSocketConnection('ws://apint.ddns.net:3617');
        const sendRandomInteger = async () => {
            await IIDUtility.coroutineUpdateTimestamps();
            while (true) {
                const player_index = 3;
                const randomInteger = Math.floor(Math.random() * 2147483647);
                if (wsManager.isWebSocketConnected()) {
                    const bytes = IIDUtility.indexIntegerNowRelayMillisecondsToBytes(player_index,randomInteger,50);  // sending random integer
                    wsManager.ws.send(bytes);
                    console.log(`Sent Bytes: ${bytes}`);
                }
                await new Promise(resolve => setTimeout(resolve, 4000));  // Wait 4 seconds before sending another
            }
        };
        sendRandomInteger();
    }
}

new CodeDemoPingRandomIntegerNow();


















/**
 

import { Buffer } from 'buffer'; // Buffer polyfill
import fetch from 'node-fetch';
// WebSocket is natively supported in browsers
// import { WebSocket } from 'ws'; // Not needed for browsers

// ntp-client replacement (example using worldtimeapi)
async function getTime() {
  const response = await fetch('http://worldtimeapi.org/api/timezone/Etc/UTC');
  const data = await response.json();
  console.log(data.datetime);
}

// DNS lookup replacement (example using Google DNS resolver)
async function getDNSInfo(domain) {
  const response = await fetch(`https://dns.google/resolve?name=${domain}`);
  const data = await response.json();
  console.log(data);
}


// Example usage of Buffer (for example, encoding some data)
const buffer = Buffer.from('Hello World', 'utf-8');
console.log(buffer.toString('hex'));



class IIDUtility {
    static defaultNtpServer = "be.pool.ntp.org";
    static defaultGlobalNtpOffsetInMilliseconds = 0;

    static isTextIpv4(serverName) {
        // Check if the string is in 255.255.255.255 format
        const pattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
        return pattern.test(serverName);
    }

    static async getIpv4(serverName) {
        if (this.isTextIpv4(serverName)) {
            return serverName;
        }
        const addresses = await dns.lookup(serverName);
        return addresses.address;
    }

    static getDefaultGlobalNtpOffsetInMilliseconds() {
        return this.defaultGlobalNtpOffsetInMilliseconds;
    }

    static bytesToInt(buffer) {
        return buffer.readInt32LE(0);
    }

    static bytesToIndexInteger(buffer) {
        return {
            index: buffer.readInt32LE(0),
            value: buffer.readInt32LE(4),
        };
    }

    static bytesToIndexDate(buffer) {
        return {
            index: buffer.readInt32LE(0),
            date: buffer.readBigUInt64LE(4),
        };
    }

    static bytesToIndexIntegerDate(buffer) {
        return {
            index: buffer.readInt32LE(0),
            value: buffer.readInt32LE(4),
            date: buffer.readBigUInt64LE(8),
        };
    }

    static integerToBytes(value) {
        const buffer = Buffer.alloc(4);
        buffer.writeInt32LE(value);
        return buffer;
    }

    static indexIntegerToBytes(index, value) {
        const buffer = Buffer.alloc(8);
        buffer.writeInt32LE(index, 0);
        buffer.writeInt32LE(value, 4);
        return buffer;
    }

    static indexIntegerDateToBytes(index, value, date) {
        const buffer = Buffer.alloc(16);
        buffer.writeInt32LE(index, 0);
        buffer.writeInt32LE(value, 4);
        buffer.writeBigUInt64LE(BigInt(date), 8);
        return buffer;
    }

    static indexIntegerNowRelayMillisecondsToBytes(index, value, delayInMilliseconds) {
        const currentTimeMilliseconds = Date.now();
        const adjustedTimeMilliseconds = currentTimeMilliseconds + delayInMilliseconds + this.defaultGlobalNtpOffsetInMilliseconds;
        return this.indexIntegerDateToBytes(index, value, adjustedTimeMilliseconds);
    }

    static textShortcutToBytes(text) {
        try {
            if (text.startsWith("i:")) {
                const integer = parseInt(text.split(":")[1]);
                return this.integerToBytes(integer);
            } else if (text.startsWith("ii:")) {
                const [index, integer] = text.split(":")[1].split(",").map(Number);
                return this.indexIntegerToBytes(index, integer);
            } else if (text.startsWith("iid:")) {
                const [index, integer, delay] = text.split(":")[1].split(",").map(Number);
                return this.indexIntegerNowRelayMillisecondsToBytes(index, integer, delay);
            } else {
                text = text.replace(/\s+/g, " ").trim();
                const tokens = text.split(/,| /).map(Number);
                if (tokens.length === 1) {
                    return this.integerToBytes(tokens[0]);
                } else if (tokens.length === 2) {
                    return this.indexIntegerToBytes(tokens[0], tokens[1]);
                } else if (tokens.length === 3) {
                    return this.indexIntegerNowRelayMillisecondsToBytes(tokens[0], tokens[1], tokens[2]);
                } else {
                    return this.integerToBytes(parseInt(text));
                }
            }
        } catch (error) {
            console.error("Error", error);
        }
        return null;
    }

    static getRandomInteger(fromValue, toValue) {
        return Math.floor(Math.random() * (toValue - fromValue + 1)) + fromValue;
    }

    static getRandomInteger100() {
        return this.getRandomInteger(0, 100);
    }

    static getRandomIntegerIntMax() {
        return this.getRandomInteger(-2147483647, 2147483647);
    }

    static getRandomIntegerIntMaxPositive() {
        return this.getRandomInteger(0, 2147483647);
    }

    static i(integerValue) {
        return this.integerToBytes(integerValue);
    }

    static ii(index, integerValue) {
        return this.indexIntegerToBytes(index, integerValue);
    }

    static iid(index, integerValue, date) {
        return this.indexIntegerDateToBytes(index, integerValue, date);
    }

    static iidMs(index, integerValue, milliseconds) {
        return this.indexIntegerDateToBytes(index, integerValue, milliseconds);
    }
}

class NtpOffsetFetcher {
    static defaultGlobalNtpOffsetInMilliseconds = 0;

    static fetchNtpOffsetInMilliseconds(ntpServer) {
        return new Promise((resolve, reject) => {
            ntpClient.getNetworkTime(ntpServer, 123, (err, date) => {
                if (err) {
                    console.error(`Error NTP Fetch: ${ntpServer}`, err);
                    resolve(0);
                } else {
                    const offset = Date.now() - date.getTime();
                    resolve(offset);
                }
            });
        });
    }

    static async setGlobalNtpOffsetInMilliseconds(ntpServer = IIDUtility.defaultNtpServer) {
        try {
            const offset = await this.fetchNtpOffsetInMilliseconds(ntpServer);
            this.defaultGlobalNtpOffsetInMilliseconds = offset;
            console.log(`Default Global NTP Offset: ${this.defaultGlobalNtpOffsetInMilliseconds} ms (${ntpServer})`);
        } catch (error) {
            console.error("Error setting global NTP offset", error);
            this.defaultGlobalNtpOffsetInMilliseconds = 0;
        }
    }

    static getGlobalNtpOffsetInMilliseconds() {
        return this.defaultGlobalNtpOffsetInMilliseconds;
    }
}

(async () => {
    await NtpOffsetFetcher.setGlobalNtpOffsetInMilliseconds();
})();




class IIDWebSocketConnection {
    constructor(url) {
        this.url = url;
        this.connect();
    }

    sendInteger(value) {
        const buffer = IIDUtility.integerToBytes(value);
        this.ws.send(buffer);
    }

    sendIndexInteger(index, value) {
        const buffer = IIDUtility.indexIntegerToBytes(index, value);
        this.ws.send(buffer);
    }

    sendIndexIntegerNowRelayMilliseconds(index, value, delayInMilliseconds) {
        const buffer = IIDUtility.indexIntegerNowRelayMillisecondsToBytes(index, value, delayInMilliseconds);
        this.ws.send(buffer);
    }

    sendIndexIntegerDate(index, value, date) {
        const buffer = IIDUtility.indexIntegerDateToBytes(index, value, date);
        this.ws.send(buffer);
    }
    isWebSocketConnected() {
        return this.ws.readyState === WebSocket.OPEN;
    }
    connect() {
        this.ws = new WebSocket(this.url);

        this.ws.on('open', () => {
            console.log('Connected to WebSocket server');
        });

        this.ws.on('message', (data) => {
            console.log('Received:', data);
            const length = data.length;
            if (length === 4) {
                console.log('Received I:', IIDUtility.bytesToInt(data));
            } else if (length === 8) {
                console.log('Received II:', IIDUtility.bytesToIndexInteger(data));
            } else if (length === 12) {
                console.log('Received ID:', IIDUtility.bytesToIndexDate(data));
            } else if (length === 16) {
                console.log('Received IID:', IIDUtility.bytesToIndexIntegerDate(data));
            }
        });

        this.ws.on('close', () => {
            console.log('Disconnected from WebSocket server');
            setTimeout(() => this.connect(), 4000);
        });

        this.ws.on('error', (err) => {
            console.error('WebSocket error:', err);
        });
    }
}


class CodeDemoPingRandomIntegerNow {
    constructor() {
        const wsManager = new IIDWebSocketConnection('ws://apint.ddns.net:3617');
        const sendRandomInteger = async () => {
            while (true) {
                const player_index = 3;
                const randomInteger = IIDUtility.getRandomIntegerIntMax();
                if (wsManager.isWebSocketConnected()) {
                    wsManager.sendIndexIntegerNowRelayMilliseconds(player_index, randomInteger, 50);
                }
                console.log(`Sent I: ${randomInteger}`);
                await new Promise(resolve => setTimeout(resolve, 4000));
            }
        };
        sendRandomInteger();
    }
}

//new CodeDemoPingRandomIntegerNow();





 */
