import { SocketClient } from "@alephscript/socket-client";
import {
  IOrchestratorChannels,
  SysMessage,
  UIMessage,
} from "../orchestration/types";
import { Logger } from "@/utils";
import { Subscription } from "rxjs";

const BORRAR_ESTADO_A_CADA_PLAY_STEP = true;

export interface Bloque {
  id?: string;
  estado?: Bloque | any;
  fecha?: Date;
}

export let Bloque: Bloque = {
  id: "genesis",
  estado: {},
  fecha: new Date(),
};

export enum RunStateEnum {
  PLAY = "PLAY",
  PLAY_STEP = "PLAY_STEP",
  PAUSE = "PAUSE",
  STOP = "STOP",
}

export interface IMundo {
  nombre?: string;
  modelo?: {
    nombre?: string;
    dominio?: {
      base?: {
        [key: string]: any;
      };
    };
    dia?: any;
    [key: string]: any;
  };
  runState?: RunStateEnum;
  [key: string]: any;
}

export class AlephScriptClient extends SocketClient {
  sus: string[];
  threads: any[] = [];
  private channels?: IOrchestratorChannels;
  private sysChannelSubscriptions: Subscription[] = [];

  constructor(
    name = "ClientID",
    url: string = "http://localhost:3000",
    namespace: string = "/runtime",
    autoConnect = true
  ) {
    super(name, url, namespace, autoConnect);
    this.sus = [
      "GET_LIST_OF_THREADS",
      "GET_ENGINE",
      "SET_DOMAIN_BASE_DATA",
      "SET_MODEL_RPC_DATA",
      "SET_EXECUTION_PROCESS",
    ];
  }

  /**
   * Initialize sys channel integration for health check broadcasting
   */
  initializeSysChannelIntegration(channels: IOrchestratorChannels): void {
    this.channels = channels;

    // Listen for user input
    channels.ui.subscribe((message) => {
      console.log("channels.ui input received:", message);
    });

    channels.ui.filter("render_request").subscribe((message) => {
      console.log("AlephScriptClient Render request received:", message);
      this.handleRenderRequest(message);
    });

    // Subscribe to health check messages from sys channel
    const healthCheckSub = channels.sys
      .filter("health_check")
      .subscribe((message) => {
        console.log("Health check received:", message);
        this.handleSysHealthCheck(message);
      });

    // Subscribe to error messages from sys channel
    const errorSub = channels.sys.filter("error").subscribe((message) => {
      this.handleSysError(message);
    });

    // Subscribe to warning messages from sys channel
    const warningSub = channels.sys.filter("warning").subscribe((message) => {
      this.handleSysWarning(message);
    });

    // Store subscriptions for cleanup
    this.sysChannelSubscriptions.push(healthCheckSub, errorSub, warningSub);

    Logger.info(`🔌 AlephScript client ${this.name} connected to sys channel`);
  }

  handleRenderRequest(message: UIMessage & { type: "render_request" }) {
    console.log("AlephScriptClient Render request received:", message);
  }

  /**
   * Handle health check messages from sys channel and broadcast to /runtime
   */
  private handleSysHealthCheck(
    message: SysMessage & { type: "health_check" }
  ): void {
    const { serviceId, health, message: healthMessage } = message.payload;

    // Broadcast health check to /runtime namespace
    this.io.emit("SYS_HEALTH_CHECK", {
      serviceId,
      health,
      message: healthMessage,
      timestamp: message.timestamp,
      source: message.source,
    });

    Logger.info(
      `🔍 Broadcasting health check for ${serviceId}: ${
        health ? "healthy" : "unhealthy"
      } to /runtime`
    );
  }

  /**
   * Handle error messages from sys channel and broadcast to /runtime
   */
  private handleSysError(message: SysMessage & { type: "error" }): void {
    const { error, message: errorMessage } = message.payload;

    // Broadcast error to /runtime namespace
    this.io.emit("SYS_ERROR", {
      error,
      message: errorMessage,
      timestamp: message.timestamp,
      source: message.source,
    });

    Logger.error(
      `🔍 Broadcasting system error from ${message.source} to /runtime: ${errorMessage}`
    );
  }

  /**
   * Handle warning messages from sys channel and broadcast to /runtime
   */
  private handleSysWarning(message: SysMessage & { type: "warning" }): void {
    const { message: warningMessage } = message.payload;

    // Broadcast warning to /runtime namespace
    this.io.emit("SYS_WARNING", {
      message: warningMessage,
      timestamp: message.timestamp,
      source: message.source,
      payload: message.payload,
    });

    Logger.warn(
      `🔍 Broadcasting system warning from ${message.source} to /runtime: ${warningMessage}`
    );
  }

  /**
   * Cleanup sys channel subscriptions
   */
  private cleanupSysChannelIntegration(): void {
    this.sysChannelSubscriptions.forEach((sub) => {
      if (sub && typeof sub.unsubscribe === "function") {
        sub.unsubscribe();
      }
    });
    this.sysChannelSubscriptions = [];

    if (this.channels) {
      Logger.info(
        `🔌 AlephScript client ${this.name} disconnected from sys channel`
      );
    }
  }

  /**
   * Disconnect and cleanup all sys channel subscriptions
   */
  disconnect(): void {
    this.cleanupSysChannelIntegration();
    // Disconnect socket if connected
    if (this.io && this.io.connected) {
      this.io.disconnect();
    }
  }

  run() {
    console.log(systemMessage(`Socket.Connected`));

    this.room("MAKE_MASTER", { features: [] });
    this.room(
      "MAKE_MASTER",
      { features: ["GET_LIST_OF_THREADS", "GET_ENGINE"] },
      "IDE-app"
    );

    this.sus.forEach((k) => this.io.off(k));
    this.io.on("GET_LIST_OF_THREADS", (...args) => {
      console.log(
        agentMessage(
          this.name,
          "Received (GET_LIST_OF_THREADS) from: " + args[0].requesterName
        )
      );
      this.sendFrameworkState(args);
    });

    this.io.on("SET_DOMAIN_BASE_DATA", (...args) => {
      const rData = args[0];
      console.log(
        systemMessage(this.name + ">> SET_DOMAIN_BASE_DATA ENGINE... to: ")
      );
      const action = rData?.action;

      const engine = rData.engine;
      const fia = this.threads[engine];

      if (action == "SET_DATA") {
        const info = rData.blob;

        if (info?.name == "mundo") {
          const mundo = (info?.value?.mundo || {}) as IMundo;

          Object.keys(mundo).forEach((k: any) => {
            console.log("Update mundo property", k); //, mundo[k])

            if (k == "modelo") {
              Object.keys(mundo[k]).forEach((kk) => {
                console.log("Update modelo property", kk); //, mundo[k][kk])
                fia.mundo.modelo[kk] = mundo[k][kk];
              });
            } else {
              fia.mundo[k] = mundo[k];
            }
          });
        }
      }
      console.log("After done", fia.mundo.nombre, fia.mundo.modelo.nombre);
      this.sendFrameworkState(args);
    });
    this.io.on("SET_MODEL_RPC_DATA", (...args) => {
      const rData = args[0];
      console.log(
        systemMessage(this.name + ">> SET_MODEL_RPC_DATA ENGINE... to: "),
        rData
      );
      const action = rData?.action;

      const engine = rData.engine;
      const fia = this.threads[engine];

      if (action == "SET_DATA") {
        const c = fia.mundo.modelo.dominio.base["RPC"];
        fia.mundo.modelo.dominio.base["RPC"] = {
          ...c,
          ...(rData?.app?.mundo?.modelo?.dominio?.base["RPC"] || { rpcid: 1 }),
        };
      }
      console.log(
        systemMessage(this.name + ">> SET_MODEL_RPC_DATA ENGINE... to: "),
        JSON.stringify(fia?.mundo?.modelo?.dominio?.base["RPC"] || {})
      );
      this.sendFrameworkState(args);
    });

    this.io.on("GET_ENGINE", (...args) => {
      const rData = args[0];
      console.log(systemMessage(this.name + ">> DO ENGINE... PAYLOAD >>: "));

      // START/STOP
      const action = rData?.data?.action;

      const engine = rData?.data?.engine;
      const fia = this.threads[engine];

      console.log(
        systemMessage(this.name + ">> DO ENGINE... PAYLOAD >>: "),
        fia.mundo.nombre
      );

      console.log(
        systemMessage(this.name + ">> DATA RPC... to: "),
        JSON.stringify(fia?.mundo?.modelo?.dominio?.base["RPC"]?.al || {})
      );

      // console.log("BloqueDebuguer", Bloque.estado)
      if (BORRAR_ESTADO_A_CADA_PLAY_STEP) {
        Object.keys(Bloque.estado).forEach((k) => {
          Bloque.estado[k] = [];
        });
      }
      console.log(
        agentMessage(
          "APP_PROGRESS_3",
          "S:>" +
            action +
            ":>" +
            fia.nombre +
            ":>" +
            fia.runState +
            ":>" +
            fia.mundo.runState
        )
      );

      switch (action as RunStateEnum) {
        case RunStateEnum.PLAY:
        case RunStateEnum.PLAY_STEP:
          if (fia.runState == RunStateEnum.PAUSE) {
            console.log(
              agentMessage(
                "APP_PROGRESS_3",
                "S:>" +
                  "RESUMING" +
                  ":>" +
                  fia.nombre +
                  ":>" +
                  fia.runState +
                  ":>" +
                  fia.mundo.runState
              )
            );

            fia.mundo.runState = action;
            fia?.runStateEvent.next(action);
          } else {
            console.log(
              agentMessage(
                "APP_PROGRESS_3",
                "S:>" +
                  "BOOTING" +
                  ":>" +
                  fia.nombre +
                  ":>" +
                  fia.runState +
                  ":>" +
                  fia.mundo.runState
              )
            );

            this.menuAnswer(engine, action);
          }
          break;
        case RunStateEnum.STOP:
          fia?.runStateEvent.next(RunStateEnum.STOP);
          break;
        case RunStateEnum.PAUSE:
          fia.runStateEvent.next(RunStateEnum.PAUSE);
          break;
        default:
          console.log(
            "---------- DESCONOCIDA ACTION",
            action,
            action as RunStateEnum
          );
      }
      // console.log(this.name, "Antes de sendFrameworkState", fia.mundo.modelo.dia)
      this.sendFrameworkState(args);
    });
  }

  menuAnswer(engine: any, action: any) {
    console.log("THE A menuAnswer:", this.name, engine, action);
  }

  sendFrameworkState(args: any[]) {
    console.log("THE A sendFrameworkState:", this.name, args);
  }
}

function agentMessage(name: any, arg1: string): any {
  console.log("THE A agentMessage:", name, arg1);
}
function systemMessage(arg1: string): any {
  console.log("THE A systemMessage:", "SYS", arg1);
}
