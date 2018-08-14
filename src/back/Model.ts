import { CollectionInsertOneOptions, FindOneAndReplaceOption, FindOneOptions } from "mongodb";
import { IInsert } from "../interfaces/IInsert";
import { IPersist } from "../interfaces/IPersist";
import { isObject, isString } from "../utils/isType";
import { IModel } from "./interfaces/IModel";
import { IRepository } from "./interfaces/IRepository";
import { toMongo } from "./toMongo";

export class Model<P extends IPersist, I extends IInsert> implements IModel<P> {
  protected readonly repository: IRepository<P>;
  protected readonly Persist: { new (data?: any): P };
  protected readonly Insert: { new (data?: any): I };
  protected readonly send: (payload: object, uid: string, wsid: string, excludeCurrentDevice?: boolean) => void;

  constructor(
    repository: IRepository<P>,
    Persist: { new (data?: any): P },
    Insert: { new (data?: any): I },
    send: (payload: object, uid: string, wsid: string, excludeCurrentDevice?: boolean) => void,
  ) {
    this.repository = repository;
    this.Persist = Persist;
    this.Insert = Insert;
    this.send = send;
  }

  public async read(query: { [key: string]: any } = {}, options?: FindOneOptions, uid?: string): Promise<P[]> {
    const items = await this.repository.find(query, options);

    return items.map((item) => new this.Persist(item));
  }

  public async readOne(query: { [key: string]: any } = {}, options?: FindOneOptions, uid?: string): Promise<P | null> {
    const item = await this.repository.findOne(query, options);

    if (item) {
      return new this.Persist(item);
    }

    return null;
  }

  public async getMap(options?: FindOneOptions): Promise<Map<string, P>> {
    const items: any[] = await this.read(options);
    const map: Map<string, P> = new Map();

    for (const item of items) {
      if (isString(item.id)) {
        map.set(item.id, new this.Persist(item));
      }
    }

    return map;
  }

  public async readById(id: string, options?: FindOneOptions): Promise<P | null> {
    const result: P | null = await this.repository.findById(id, options);

    if (result !== null) {
      return new this.Persist(result);
    }

    return null;
  }

  public async create(
    data: { [key: string]: any },
    uid: string,
    wsid: string,
    options?: CollectionInsertOneOptions,
    excludeCurrentDevice?: boolean,
  ): Promise<P | null> {
    const insert: I = new this.Insert(data);
    const result: any = await this.repository.insertOne(
      insert.toJS(),
      isObject(options) && Object.keys(options).length > 0 ? options : undefined,
    );
    const persist: P = new this.Persist(result);

    this.send({ create: persist.toJS() }, uid, wsid, excludeCurrentDevice);

    return persist;
  }

  public async update(
    data: { [key: string]: any },
    uid: string,
    wsid: string,
    options?: FindOneAndReplaceOption,
    excludeCurrentDevice?: boolean,
  ): Promise<P | null> {
    let persist: P = new this.Persist(data);
    const { _id, ...$set } = toMongo(persist);

    const result: any | null = await this.repository.findOneAndUpdate(
      { _id },
      { $set },
      {
        returnOriginal: false,
        ...(isObject(options) && Object.keys(options).length > 0 ? options : undefined),
      },
    );

    if (result !== null) {
      persist = new this.Persist(result);

      this.send({ update: persist.toJS() }, uid, wsid, excludeCurrentDevice);

      return persist;
    }

    return null;
  }

  public async remove(
    id: string,
    uid: string,
    wsid: string,
    options?: { projection?: object; sort?: object },
    excludeCurrentDevice?: boolean,
  ): Promise<P | null> {
    const result: object | null = await this.repository.findByIdAndRemove(
      id,
      isObject(options) && Object.keys(options).length > 0 ? options : undefined,
    );

    if (result !== null) {
      const persist: P = new this.Persist(result);

      this.send({ remove: persist.toJS() }, uid, wsid, excludeCurrentDevice);

      return persist;
    }

    return null;
  }
}
