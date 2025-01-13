// Required modules
// npm install ntp-client ws

const dns = require('dns').promises;
const ntpClient = require('ntp-client');
const WebSocket = require('ws');

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

new CodeDemoPingRandomIntegerNow();




/**
 

 */
