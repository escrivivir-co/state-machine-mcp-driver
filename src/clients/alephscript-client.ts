import { SocketClient } from "@alephscript/socket-client";

const BORRAR_ESTADO_A_CADA_PLAY_STEP = true;

export interface Bloque {

	id?: string;
	estado?: Bloque | any;
    fecha?: Date;

}

export let Bloque: Bloque = {
    id: "genesis",
    estado: {},
    fecha: new Date()
}

export enum RunStateEnum {
	PLAY = "PLAY",
	PLAY_STEP = "PLAY_STEP",
	PAUSE = "PAUSE",
	STOP = "STOP"
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

