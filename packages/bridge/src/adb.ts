/**
 * ADB layer — pure-TypeScript ADB client via Tango (ya-webadb).
 *
 * Talks to the local `adb server` (127.0.0.1:5037) using
 * @yume-chan/adb-server-node-tcp, so USB, Wi-Fi (`adb connect`) and
 * emulator-container devices all work without any native dependency.
 */
import { Adb, AdbServerClient } from "@yume-chan/adb";
import { AdbServerNodeTcpConnector } from "@yume-chan/adb-server-node-tcp";

export interface DeviceInfo {
  serial: string;
  state: string;
  model: string;
  product: string;
  width: number;
  height: number;
}

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function parseWmSize(out: string): { width: number; height: number } {
  const m = out.match(/(\d+)\s*x\s*(\d+)/);
  return m ? { width: parseInt(m[1], 10), height: parseInt(m[2], 10) } : { width: 0, height: 0 };
}

export class AdbManager {
  private client: AdbServerClient;
  private adb: Adb | null = null;
  private serial: string | null = null;

  constructor(adbHost = "127.0.0.1", adbPort = 5037) {
    this.client = new AdbServerClient(new AdbServerNodeTcpConnector({ host: adbHost, port: adbPort }));
  }

  /** `adb version` — also serves as "is adb server reachable?" check. */
  async checkServer(): Promise<number> {
    return this.client.getVersion();
  }

  async listDevices(): Promise<{ serial: string; state: string }[]> {
    const devices = await this.client.getDevices();
    return devices.map((d) => ({ serial: d.serial, state: String(d.state) }));
  }

  /** Connect to a device. Defaults to the first `device`-state transport. */
  async connect(serial?: string): Promise<{ serial: string; state: string }> {
    const devices = await this.client.getDevices();
    const dev =
      (serial && devices.find((d) => d.serial === serial)) ||
      devices.find((d) => String(d.state) === "device") ||
      devices[0];
    if (!dev) {
      throw new Error(
        "No Android device found. For physical: enable USB debugging & `adb devices`. " +
          "For emulator container: `adb connect localhost:5555`."
      );
    }
    if (this.adb && this.serial === dev.serial) return { serial: dev.serial, state: String(dev.state) };
    if (this.adb) await this.adb.close().catch(() => {});
    this.adb = await this.client.createAdb({ serial: dev.serial });
    this.serial = dev.serial;
    return { serial: dev.serial, state: String(dev.state) };
  }

  get connectedSerial(): string | null {
    return this.serial;
  }

  private need(): Adb {
    if (!this.adb) throw new Error("Not connected to a device. Call connect() first.");
    return this.adb;
  }

  private spawner() {
    const svc = this.need().subprocess.shellProtocol;
    if (!svc) throw new Error("Device does not support the ADB shell protocol.");
    return svc;
  }

  async shell(command: string): Promise<ShellResult> {
    const r = await this.spawner().spawnWaitText(command);
    return { stdout: r.stdout, stderr: r.stderr, exitCode: r.exitCode };
  }

  async screenshot(): Promise<Buffer> {
    const r = await this.spawner().spawnWait("screencap -p");
    if (r.exitCode !== 0 || r.stdout.length === 0) throw new Error("screencap failed");
    return Buffer.from(r.stdout);
  }

  async tap(x: number, y: number): Promise<void> {
    await this.shell(`input tap ${Math.round(x)} ${Math.round(y)}`);
  }

  async swipe(x1: number, y1: number, x2: number, y2: number, durationMs = 300): Promise<void> {
    await this.shell(
      `input swipe ${Math.round(x1)} ${Math.round(y1)} ${Math.round(x2)} ${Math.round(y2)} ${Math.round(durationMs)}`
    );
  }

  /** key: KEYCODE_* name (e.g. "HOME", "BACK") or numeric code (3=home, 4=back). */
  async key(code: string | number): Promise<void> {
    await this.shell(`input keyevent ${code}`);
  }

  /** Types text (%s for space, shell-escaped). */
  async text(value: string): Promise<void> {
    const escaped = value.replace(/ /g, "%s").replace(/(["'\\$`!])/g, "\\$1");
    await this.shell(`input text "${escaped}"`);
  }

  /** Launch an app by package name. */
  async openApp(pkg: string): Promise<ShellResult> {
    return this.shell(`monkey -p ${pkg} -c android.intent.category.LAUNCHER 1`);
  }

  async info(): Promise<DeviceInfo> {
    const adb = this.need();
    const [model, product, wm] = await Promise.all([
      adb.getProp("ro.product.model").catch(() => ""),
      adb.getProp("ro.product.name").catch(() => ""),
      this.shell("wm size").catch(() => ({ stdout: "", stderr: "", exitCode: 1 })),
    ]);
    const { width, height } = parseWmSize(wm.stdout);
    return {
      serial: this.serial ?? "",
      state: "device",
      model: model.trim(),
      product: product.trim(),
      width,
      height,
    };
  }

  async close(): Promise<void> {
    if (this.adb) await this.adb.close().catch(() => {});
    this.adb = null;
    this.serial = null;
  }
}
