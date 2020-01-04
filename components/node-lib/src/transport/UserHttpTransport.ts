import { User, UserData, userGroupEnum } from "@rtcts/isomorphic";
import { isString } from "@rtcts/utils";
import Koa from "koa";
import { getAuthenticateMiddleware, setCookieForAuthenticate } from "../app/auth";
import { Config } from "../app/Config";
import { UserModel } from "../model/UserModel";
import { Channels } from "../webSocket/Channels";
import { HttpTransport } from "./HttpTransport";

export class UserService<
  E extends User<VA>,
  M extends UserModel<E, VA, C>,
  VA extends any[] = any[],
  C extends Config = Config,
  CH extends Channels = Channels
> extends HttpTransport<E, UserData, VA, M, CH> {
  protected readonly ACL: {
    readonly collection: string[];
    readonly read: string[];
    readonly channel: string[];
    readonly create: string[];
    readonly remove: string[];
    readonly update: string[];
    readonly updateLogin: string[];
    readonly updatePassword: string[];
    readonly updateGroup: string[];
    readonly signUp: string[];
  };

  protected readonly switchers: {
    readonly collection: boolean;
    readonly create: boolean;
    readonly read: boolean;
    readonly remove: boolean;
    readonly update: boolean;
    readonly channel: boolean;
    readonly updateLogin: boolean;
    readonly updatePassword: boolean;
    readonly updateGroup: boolean;
    readonly signUp: boolean;
  };

  constructor(
    name: string,
    Entity: new (data: any) => E,
    model: M,
    channels: CH,
    ACL: {
      collection: string[];
      read: string[];
      create: string[];
      remove: string[];
      update: string[];
      channel: string[];
      updateLogin: string[];
      updatePassword: string[];
      updateGroup: string[];
      signUp: string[];
    } = {
      collection: [userGroupEnum.admin],
      read: [userGroupEnum.admin],
      create: [userGroupEnum.admin],
      remove: [userGroupEnum.admin],
      update: [],
      channel: [],
      updateLogin: [userGroupEnum.admin],
      updatePassword: [userGroupEnum.admin],
      updateGroup: [userGroupEnum.admin],
      signUp: [userGroupEnum.admin],
    },
    switchers: {
      collection: boolean;
      read: boolean;
      create: boolean;
      remove: boolean;
      update: boolean;
      channel: boolean;
      updateLogin: boolean;
      updatePassword: boolean;
      updateGroup: boolean;
      signUp: boolean;
    } = {
      collection: true,
      read: false,
      create: false,
      remove: true,
      update: true,
      channel: true,
      updateLogin: true,
      updatePassword: true,
      updateGroup: true,
      signUp: true,
    },
  ) {
    super(name, Entity, model, channels, ACL, switchers);

    this.current();
    this.signIn();
    this.signUp();
    this.updateLogin();
    this.updatePassword();
    this.updateGroup();
  }

  protected collection(): void {
    const URL = `/${this.name}/collection`;

    this.router.get(
      URL,
      getAuthenticateMiddleware(),
      async (ctx: Koa.Context): Promise<void> => {
        await this.executor(
          ctx,
          URL,
          this.ACL.collection,
          this.switchers.collection,
          async (userId: string) => {
            let collection: E[] = [];

            if (ctx.state.user.group === userGroupEnum.admin) {
              collection = await this.model.getUsers();
            } else {
              const result = await this.model.getUserById(userId);

              if (result) {
                collection = [result];
              }
            }

            ctx.status = 200;
            ctx.type = "application/json";
            ctx.body = JSON.stringify(collection.map((item) => item.getUnSecureData()));
          },
        );
      },
    );
  }

  // ! The update method is used to change user data that does not affect access control, such as avatar, name, and other data
  protected update(): void {
    const URL = `/${this.name}/update`;

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
            if (userId !== ctx.body.id) {
              throw new Error("The model isn't updating");
            }

            const entity: E | null = await this.model.update(ctx.body, userId, wsid);

            if (entity) {
              ctx.status = 200;
              ctx.type = "application/json";
              ctx.body = JSON.stringify(entity.toObject());
            } else {
              throw new Error("The user model isn't updating");
            }
          },
        );
      },
    );
  }

  // ! Returns the user object that was retrieved after authorization
  protected current(): void {
    const URL = `/${this.name}/current`;

    this.router.get(URL, getAuthenticateMiddleware(), async (ctx: Koa.Context) => {
      const user = new this.Entity(ctx.state.user);

      if (user.isEntity()) {
        ctx.status = 200;
        ctx.type = "application/json";
        ctx.body = JSON.stringify(user.getUnSecureData());
      }
    });
  }

  protected signIn(): void {
    const URL = `/${this.name}/signIn`;

    this.router.post(
      URL,
      async (ctx: Koa.Context): Promise<void> => {
        await this.executor(ctx, URL, [], true, async () => {
          const token: string | null = await this.model.signIn(ctx.body);

          if (isString(token)) {
            setCookieForAuthenticate(ctx, token);

            ctx.status = 200;
            ctx.type = "text/plain";
            ctx.body = "";
          } else {
            const message = `[ ${this.constructor.name} ][ ${URL} ][ token isn't creating ]`;

            ctx.throw(message, 404);
          }
        });
      },
    );
  }

  protected signUp(): void {
    const URL = `/${this.name}/signUp`;

    this.router.post(URL, getAuthenticateMiddleware(), async (ctx: Koa.Context) => {
      await this.executor(ctx, URL, this.ACL.signUp, this.switchers.signUp, async () => {
        const token: string | null = await this.model.signUp(ctx.body);

        if (isString(token)) {
          setCookieForAuthenticate(ctx, token);

          ctx.status = 200;
          ctx.type = "text/plain";
          ctx.body = "";
        } else {
          const message = `[ ${this.constructor.name} ][ ${URL} ][ token isn't creating ]`;

          ctx.throw(message, 404);
        }
      });
    });
  }

  protected updateLogin(): void {
    const URL = `/${this.name}/updateLogin`;

    this.router.post(URL, getAuthenticateMiddleware(), async (ctx: Koa.Context) => {
      await this.executor(
        ctx,
        URL,
        this.ACL.updateLogin,
        this.switchers.updateLogin,
        async (userId: string, wsid: string) => {
          const user: E | null = await this.model.updateLogin(ctx.body, userId, wsid);

          if (user) {
            ctx.status = 200;
            ctx.type = "application/json";
            ctx.body = JSON.stringify(user.getUnSecureData());
          } else {
            const message = `[ ${this.constructor.name} ][ ${URL} ][ login isn't updating ]`;

            ctx.throw(message, 404);
          }
        },
      );
    });
  }

  protected updatePassword(): void {
    const URL = `/${this.name}/updatePassword`;

    this.router.post(URL, getAuthenticateMiddleware(), async (ctx: Koa.Context) => {
      await this.executor(
        ctx,
        URL,
        this.ACL.updatePassword,
        this.switchers.updatePassword,
        async (userId: string, wsid: string) => {
          if (ctx.body.id !== userId) {
            throw new Error("Password isn't updating");
          }

          const user: E | null = await this.model.updatePassword(ctx.body, userId, wsid);

          if (user) {
            ctx.status = 200;
            ctx.type = "application/json";
            ctx.body = JSON.stringify(user.getUnSecureData());
          } else {
            const message = `[ ${this.constructor.name} ][ ${URL} ][ password isn't updating ]`;

            ctx.throw(message, 404);
          }
        },
      );
    });
  }

  protected updateGroup(): void {
    const URL = `/${this.name}/updateGroup`;

    this.router.post(URL, getAuthenticateMiddleware(), async (ctx: Koa.Context) => {
      await this.executor(
        ctx,
        URL,
        this.ACL.updateGroup,
        this.switchers.updateGroup,
        async (userId: string, wsid: string) => {
          const { ids, group } = ctx.body;

          if (ids.length === 1 && ids[0] !== userId) {
            throw new Error("Group isn't updating");
          }

          const users: E[] = await this.model.updateGroup(ids, group, userId, wsid);

          if (users) {
            ctx.status = 200;
            ctx.type = "application/json";
            ctx.body = JSON.stringify(users.map((user) => user.getUnSecureData()));
          } else {
            const message = `[ ${this.constructor.name} ][ ${URL} ][ password isn't updating ]`;

            ctx.throw(message, 404);
          }
        },
      );
    });
  }
}
