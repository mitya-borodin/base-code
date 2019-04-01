import { IEntity, IUser } from "@borodindmitriy/interfaces";
import { IRepository } from "./IRepository";

export interface IUserRepository<U extends IEntity & IUser> extends IRepository<U> {
  id: string;
  user: U | void;
  isToken: boolean;
  isAuthorized: boolean;
  isAdmin: boolean;

  signIn(data: { [key: string]: any }): Promise<void>;

  signOut(): Promise<void>;

  signUp(data: { [key: string]: any }): Promise<boolean>;

  updateLogin(data: { [key: string]: any }): Promise<void>;

  updatePassword(data: { [key: string]: any }): Promise<void>;

  updateGroup(ids: string[], group: string): Promise<void>;

  remove(id: string): Promise<void>;
}
