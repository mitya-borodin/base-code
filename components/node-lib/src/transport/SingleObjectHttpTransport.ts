/* eslint-disable @typescript-eslint/no-explicit-any */
import { Entity, User, UserData } from "@rtcts/isomorphic";
import Koa from "koa";
import { getAuthenticateMiddleware } from "../app/auth";
import { SingleObjectModel } from "../model/SingleObjectModel";
import { Channels } from "../webSocket/Channels";
import { BaseHttpTransport, BaseHttpTransportACL } from "./BaseHttpTransport";

export interface SingleObjectHttpTransportACL extends BaseHttpTransportACL {
  readonly getItem: string[];
  readonly update: string[];
}

export class SingleObjectHttpTransport<
  MODEL extends SingleObjectModel<ENTITY, DATA, VA>,
  ENTITY extends Entity<DATA, VA>,
  DATA,
  VA extends any[],
  USER extends User<USER_DATA, USER_VA>,
  USER_DATA extends UserData = UserData,
  USER_VA extends object = object,
  CH extends Channels = Channels
> extends BaseHttpTransport<USER, USER_DATA, USER_VA, CH> {
  protected readonly Entity: new (data?: any) => ENTITY;
  protected readonly model: MODEL;
  protected readonly ACL: SingleObjectHttpTransportACL;
  protected readonly switchers: {
    readonly getItem: boolean;
    readonly update: boolean;
    readonly channel: boolean;
  };

  constructor(
    name: string,
    Entity: new (data?: any) => ENTITY,
    model: MODEL,
    channels: CH,
    ACL: SingleObjectHttpTransportACL,
    switchers: {
      getItem: boolean;
      update: boolean;
      channel: boolean;
    } = {
      getItem: true,
      update: true,
      channel: true,
    },
    User: new (data?: any) => USER,
  ) {
    super(name, channels, ACL, switchers, User);

    this.Entity = Entity;
    this.model = model;

    this.getItem();
    this.update();
  }

  protected getItem(): void {
    const URL = `${this.basePath}`;

    this.router.get(
      URL,
      getAuthenticateMiddleware(),
      async (ctx: Koa.Context): Promise<void> => {
        await this.executor(ctx, URL, this.ACL.getItem, this.switchers.getItem, async () => {
          const response = await this.model.getItemResponse();

          if (response.result) {
            ctx.status = 200;
            ctx.type = "application/json";
            ctx.body = JSON.stringify(response);
          } else {
            const message = `[ ${this.constructor.name} ][ ${URL} ][ MODELS_NOT_FOUND ]`;

            ctx.throw(message, 404);
          }
        });
      },
    );
  }

  protected update(): void {
    const URL = `${this.basePath}`;

    this.router.post(
      URL,
      getAuthenticateMiddleware(),
      async (ctx: Koa.Context): Promise<void> => {
        await this.executor(
          ctx,
          URL,
          this.ACL.update,
          this.switchers.update,
          async (userId: string, wsid: string) => {
            const response = await this.model.updateResponse(ctx.request.body, userId, wsid);

            if (response.result) {
              ctx.status = 200;
              ctx.type = "application/json";
              ctx.body = JSON.stringify(response);
            } else {
              throw new Error("The model wasn't updated");
            }
          },
        );
      },
    );
  }
}
