import { MatrixClient } from "matrix-bot-sdk";
import * as Wemo from "wemo-client";
import { LogService } from "matrix-js-snippets";
import config from "./config";
import * as striptags from "striptags";

class WemoHandler {
    private wemo: Wemo = new Wemo();
    private client: MatrixClient;
    private devices: {
        client: any; // WemoClient
        name: string;
        isOn: boolean;
    }[] = [];

    constructor() {
        setInterval(this.discover.bind(this), 5000);
    }

    public setClient(client: MatrixClient) {
        this.client = client;
    }

    public setDeviceState(name: string, on: boolean): void {
        const device = this.devices.find(d => d.name === name);
        if (device) device.client.setBinaryState(on ? 1 : 0);
    }

    public getDevices(): { name: string, isOn: boolean }[] {
        return this.devices;
    }

    private discover(): void {
        LogService.info("WemoHandler", "Discovering devices");
        this.wemo.discover((err, deviceInfo) => {
            if (deviceInfo['modelName'] !== "Socket") return;

            const name = deviceInfo['friendlyName'];
            const client = this.wemo.client(deviceInfo);
            const cachedDevice = {client, name, isOn: false};
            this.devices.push(cachedDevice);

            LogService.info("WemoHandler", "Found device: " + name);

            if (this.client) {
                this.client.sendMessage(config.targetRoomId, {
                    body: "Discovered a new device: " + name,
                    msgtype: "m.notice",
                    status: "info",
                });
            }

            client.on('error', err2 => {
                LogService.error("WemoHandler[" + name + "]", err2);

                const idx = this.devices.indexOf(cachedDevice);
                if (idx !== -1) this.devices.splice(idx, 1);

                if (this.client) {
                    const htmlMessage = "<font color='red'>" + name + " encountered an error. See logs for details.</font>";
                    this.client.sendMessage(config.targetRoomId, {
                        formatted_body: htmlMessage,
                        body: striptags(htmlMessage),
                        format: "org.matrix.custom.html",
                        msgtype: "m.notice",
                        status: "error",
                    });
                }
            });

            client.on('binaryState', value => {
                if (this.client) {
                    let status = '<font color="red">off</font>';
                    cachedDevice.isOn = false;
                    if (value === 1) {
                        status = '<font color="green">on</font>';
                        cachedDevice.isOn = true;
                    }
                    const htmlMessage = name + " is now " + status;
                    LogService.info("WemoHandler[" + name + "]", striptags(htmlMessage));
                    this.client.sendMessage(config.targetRoomId, {
                        formatted_body: htmlMessage,
                        body: striptags(htmlMessage),
                        format: "org.matrix.custom.html",
                        msgtype: "m.notice",
                        status: "info",
                    });
                }
            });

        });
    }
}

export const WemoWatcher = new WemoHandler();