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
    static useLog = false;
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
        const view = new DataView(buffer.buffer);
        return view.getInt32(0, true);
    }

    static bytesToIndexInteger(buffer) {
        const view = new DataView(buffer.buffer);
        return {
            index: view.getInt32(0, true),
            value: view.getInt32(4, true),
        };
    }

    static bytesToIndexDate(buffer) {
        const view = new DataView(buffer.buffer);
        return {
            index: view.getInt32(0, true),
            date: view.getBigUint64(4, true),
        };
    }

    static bytesToIndexIntegerDate(buffer) {
        const view = new DataView(buffer.buffer);
        return {
            index: view.getInt32(0, true),
            value: view.getInt32(4, true),
            date: view.getBigUint64(8, true),
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
        if(IIDUtility.useLog)
            console.log(`IID: ${index}, ${value}, ${adjustedTimeMilliseconds}`);
        if(IIDUtility.useLog)
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
                if(IIDUtility.useLog)
                console.log('Unix Time from WorldTimeAPI:', data.unixtime);
                return data.unixtime; // Unix time in seconds
            } catch (error) {
                if(IIDUtility.useLog)
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
            if(IIDUtility.useLog)
            console.log('Unix Time:', unixTime);

            // Get current timestamp on the computer
            const currentTime = this.getDateTimeNowMsUTC();
            
            // Calculate the offset in milliseconds
            const offsetMilliseconds = currentTime - unixTime * 1000; // Convert unixTime (seconds) to milliseconds
            this.defaultGlobalNtpOffsetInMilliseconds = offsetMilliseconds;
            if(IIDUtility.useLog)
            console.log('Offset in milliseconds:', offsetMilliseconds);
        } catch (error) {
            if(IIDUtility.useLog)
            console.error('Error updating timestamps:', error);
        }
    }
}

// WebSocket connection handling class
class IIDWebSocketConnection {
    constructor(url) {
        this.url = url;
        this.onIntegerReceived = this.logInteger;
        this.onIndexIntegerReceived = this.logIndexInteger;
        this.onIndexDateReceived = this.logIndexDate;
        this.onIndexIntegerDateReceived = this.logIndexIntegerDate;
        this.connect();
    }

    setListenerInteger(callback) {
        this.onIntegerReceived = callback;
    }
    setListenerIntegerIndex(callback) {
        this.onIndexIntegerReceived = callback;
    }
    setListenerIndexDate(callback) {
        this.onIndexDateReceived = callback;
    }
    setListenerIndexIntegerDate(callback) {
        this.onIndexIntegerDateReceived = callback;
    }

    logInteger(value){
        if(IIDUtility.useLog)
        console.log(`I: ${value}`);
    }
    logIndexInteger(index, value){
        if(IIDUtility.useLog)
        console.log(`II: ${index}, ${value}`);
    }
    logIndexDate(index, date){
        if(IIDUtility.useLog)
        console.log(`ID: ${index}, ${date}`);
    }
    logIndexIntegerDate(index, value, date){

        if(IIDUtility.useLog)
                    console.log(`IID: ${index}, ${value}, ${date}`);
    }

    sendInteger(value) {
        const buffer = IIDUtility.integerToBytes(value);
        this.ws.send(buffer);
    }

    isWebSocketConnected() {
        return this.ws.readyState === WebSocket.OPEN;
    }

    notifyReceived(data) {
        // Handle different byte length cases
        if (data.byteLength === 4) {
            const value = IIDUtility.bytesToInt(data);
            this.onIntegerReceived?.(value);
        } else if (data.byteLength === 8) {
            const { index, value } = IIDUtility.bytesToIndexInteger(data);
            this.onIndexIntegerReceived?.(index, value);
        } else if (data.byteLength === 12) {
            const { index, date } = IIDUtility.bytesToIndexDate(data);
            this.onIndexDateReceived?.(index, date);
        } else if (data.byteLength === 16) {
            const { index, value, date } = IIDUtility.bytesToIndexIntegerDate(data);
            this.onIndexIntegerDateReceived?.(index, value, date);
        }
    }

    connect() {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            console.log('Connected to WebSocket server');
        };



        this.ws.onmessage = (event) => {
            const data = event.data;
            let byteInBlob = null;
            if (data instanceof Blob) {
                // Convert Blob to ArrayBuffer
                const reader = new FileReader();
                reader.onload = () => {
                    const arrayBuffer = reader.result;
                    byteInBlob = new Uint8Array(arrayBuffer);
        
                    this.notifyReceived(byteInBlob);
                };
                reader.readAsArrayBuffer(data);
            } else if (data instanceof ArrayBuffer) {
                byteInBlob = new Uint8Array(data);
        
                this.notifyReceived(byteInBlob);
            } else {
                console.error("Unexpected data type:", typeof data);
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
                    if(IIDUtility.useLog)
                    console.log(`Sent Bytes: ${bytes}`);
                }
                await new Promise(resolve => setTimeout(resolve, 4000));  // Wait 4 seconds before sending another
            }
        };
        sendRandomInteger();
    }
}

new CodeDemoPingRandomIntegerNow();
