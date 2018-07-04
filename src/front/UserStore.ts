import { action, computed, observable, runInAction } from "mobx";
import { userGroupEnum } from "../enums/userGroupEnum";
import { userStoreEventEnum } from "../enums/userStoreEventEnum";
import { IClientUserService } from "../interfaces/IClientUserService";
import { IPersist } from "../interfaces/IPersist";
import { IUser } from "../interfaces/IUser";
import { IUserGroup } from "../interfaces/IUserGroup";
import { IUserStore } from "../interfaces/IUserStore";
import { IWSClient } from "../interfaces/IWSClient";
import { EventEmitter } from "../isomorphic/EventEmitter";
import { isString } from "../utils/isType";

export class UserStore<U extends IUser<G> & IPersist, G extends IUserGroup> extends EventEmitter
  implements IUserStore<U, G> {
  @observable public authorization = false;
  @observable public loading = false;
  @observable public user: U & IPersist | null;
  @observable public userList: Array<U & IPersist>;

  protected User: { new (data: any): U };
  protected service: IClientUserService<U, G>;
  protected WSClient: IWSClient;

  constructor(service: IClientUserService<U, G>, WSClient: IWSClient, User: { new (data: any): U }) {
    super();

    this.service = service;
    this.WSClient = WSClient;
    this.User = User;

    this.init = this.init.bind(this);
    this.load = this.load.bind(this);
    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);
    this.registration = this.registration.bind(this);
  }

  get id() {
    if (this.user instanceof this.User) {
      return this.user.id;
    }

    return "";
  }

  get isToken() {
    return isString(localStorage.getItem("token"));
  }

  @computed
  get isUserData() {
    return this.user instanceof this.User;
  }

  @computed
  get isAdmin() {
    if (this.user instanceof this.User) {
      return this.user.group === userGroupEnum.admin;
    }

    return false;
  }

  @computed
  get isAuthorized() {
    return this.isUserData && this.isToken;
  }

  public async init(goToToken: any): Promise<void> {
    if (!this.isToken) {
      goToToken();
    } else {
      await this.load(localStorage.getItem("token"));
    }
  }

  @action("[ STORE ][ USER ][ LOAD ]")
  public async load(token): Promise<void> {
    this.authorization = true;

    try {
      const user: U | void = await this.service.load(token);

      if (user) {
        await runInAction("[SUCCESS]", async () => {
          this.user = user;
          localStorage.setItem("token", token);

          await this.WSClient.connect();
          await this.WSClient.assigmentToUserOfTheConnection();

          runInAction("[ USER_AND_WS_WAS_JOINED ]", () => {
            this.authorization = false;
          });

          this.emit(userStoreEventEnum.LOGIN);
        });
      } else {
        await this.WSClient.disconnect();

        runInAction("[FAIL]", () => {
          localStorage.removeItem("token");
          this.authorization = false;
          this.user = null;
          this.loading = false;
          this.userList = [];
        });
      }
    } catch (error) {
      console.error(error);
      await this.WSClient.disconnect("[STORE][USER][ERROR][DATA_LOADED]");

      runInAction("[ERROR]", () => {
        localStorage.removeItem("token");
        this.authorization = false;
        this.user = null;
        this.loading = false;
        this.userList = [];
      });
    }
  }

  @action("[STORE][USER][LOGIN]")
  public async login(login, password) {
    if (!this.isAuthorized) {
      this.authorization = true;

      try {
        const token: string | void = await this.service.signIn(login, password);

        if (token) {
          await this.load(token);

          return Promise.resolve("Authorization was successful");
        }
      } catch (error) {
        console.error(error);

        runInAction("[ERROR]", () => {
          this.user = null;
          this.authorization = false;
        });

        return Promise.reject("Login or password is not correct.");
      }
    }

    return Promise.resolve("You are is authorized.");
  }

  @action("[STORE][USER][LOGOUT]")
  public async logout(): Promise<void> {
    if (this.authorization) {
      try {
        this.emit(userStoreEventEnum.LOGOUT);

        await this.WSClient.disconnect("[ LOGOUT ]");

        runInAction("[SUCCESS]", () => {
          localStorage.removeItem("token");
          this.authorization = false;
          this.user = null;
          this.loading = false;
          this.userList = [];

          setTimeout(() => {
            super.clear();
          }, 100);
        });
      } catch (error) {
        console.error(error);
      }
    }
  }

  @action("[STORE][USER][REGISTRATION]")
  public async registration(
    login: string,
    password: string,
    password_confirm: string,
    userGroup: string,
  ): Promise<string | void> {
    if (!this.loading) {
      this.loading = true;

      try {
        const token: string | void = await this.service.signUp(login, password, password_confirm, userGroup as G);

        if (token) {
          await this.loadUserList();

          return Promise.resolve("Registration was successful");
        }
      } catch (error) {
        console.error(error);

        return Promise.reject("Login or password is not correct.");
      } finally {
        runInAction("[END][REGISTRATION]", () => {
          this.loading = false;
        });
      }
    }
  }

  @action("[STORE][USER][LOAD_USER_LIST]")
  public async loadUserList(): Promise<void> {
    this.loading = true;
    const users: U[] | void = await this.service.collection();

    if (Array.isArray(users)) {
      runInAction("[SUCCESS]", () => {
        this.loading = false;
        this.userList = users;
      });
    } else {
      runInAction("[ERROR]", () => {
        this.loading = false;
      });
    }
  }

  @action("[STORE][USER][UPDATE_LOGIN]")
  public async updateLogin(id: string, login: string): Promise<void> {
    this.loading = true;
    const user: U | void = await this.service.updateLogin(id, login);

    if (user instanceof this.User) {
      runInAction("[SUCCESS]", () => {
        this.loading = false;
        this.userList = this.userList.map((item) => {
          if (item.id === user.id) {
            return user;
          }

          return item;
        });
      });
    } else {
      runInAction("[ERROR]", () => {
        this.loading = false;
      });
    }
  }

  @action("[STORE][USER][UPDATE_PASSWORD]")
  public async updatePassword(id: string, password: string, password_confirm: string): Promise<void> {
    if (!this.loading) {
      this.loading = true;
      const user: U | void = await this.service.updatePassword(id, password, password_confirm);

      if (user instanceof this.User) {
        runInAction("[SUCCESS]", () => {
          this.loading = false;
          this.userList = this.userList.map((item) => {
            if (item.id === user.id) {
              return user;
            }

            return item;
          });
        });
      } else {
        runInAction("[ERROR]", () => {
          this.loading = false;
        });
      }
    }
  }

  @action("[STORE][USER][UPDATE_GROUP]")
  public async updateGroup(ids: string[], updateGroup: string): Promise<void> {
    if (!this.loading) {
      this.loading = true;
      const users: U[] | void = await this.service.updateGroup(ids, updateGroup as G);

      if (Array.isArray(users) && users.length > 0) {
        runInAction("[SUCCESS]", () => {
          this.loading = false;
          this.userList = this.userList.map((curItem) => {
            const found = users.find((newItem) => newItem.id === curItem.id);

            if (found instanceof this.User) {
              return found;
            }

            return curItem;
          });
        });
      } else {
        runInAction("[ERROR]", () => {
          this.loading = false;
        });
      }
    }
  }

  @action("[STORE][USER][REMOVE]")
  public async remove(id: string): Promise<void> {
    if (!this.loading) {
      this.loading = true;
      const user: U | void = await this.service.remove(id);

      if (user instanceof this.User) {
        runInAction("[SUCCESS]", () => {
          this.loading = false;
          this.userList = this.userList.filter((item) => item.id !== user.id);
        });
      } else {
        runInAction("[ERROR]", () => {
          this.loading = false;
        });
      }
    }
  }
}
