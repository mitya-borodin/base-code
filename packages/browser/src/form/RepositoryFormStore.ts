import { Entity } from "@rtcts/isomorphic";
import { isString } from "@rtcts/utils";
import EventEmitter from "eventemitter3";
import { Repository } from "../repository/Repository";
import { RepositoryHttpTransport } from "../transport/http/RepositoryHttpTransport";
import { WSClient } from "../transport/ws/WSClient";
import { FormStore } from "./FormStore";

export class RepositoryFormStore<
  HTTP_TRANSPORT extends RepositoryHttpTransport<ENTITY, DATA, VA, WS, PUB_SUB>,
  ENTITY extends Entity<DATA, VA>,
  DATA,
  REP extends Repository<HTTP_TRANSPORT, ENTITY, DATA, VA, WS, PUB_SUB>,
  VA extends object = object,
  WS extends WSClient = WSClient,
  PUB_SUB extends EventEmitter = EventEmitter
> extends FormStore<ENTITY, DATA, VA> {
  public static events = {
    submit: `[ RepositoryFormStore ][ SUBMIT ]`,
  };
  protected readonly Entity: new (...args: any[]) => ENTITY;
  protected readonly repository: REP;

  constructor(Entity: new (...args: any[]) => ENTITY, repository: REP) {
    super(Entity);

    this.Entity = Entity;

    // * DEPS
    this.repository = repository;

    // * BINDS
    this.openForm = this.openForm.bind(this);
    this.changeForm = this.changeForm.bind(this);
    this.submitForm = this.submitForm.bind(this);

    // ! SUBSCRIPTIONS
    this.repository.on(Repository.events.removeSubmit, this.cancel);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  protected async openForm(id?: string, ...args: any[]): Promise<ENTITY> {
    if (isString(id) && id.length > 0) {
      const entity: ENTITY | void = this.repository.map.get(id);

      if (entity instanceof this.Entity) {
        return new this.Entity(entity.toObject());
      }
    }

    return new this.Entity({});
  }

  protected async submitForm(submit: ENTITY): Promise<ENTITY | void> {
    const result: ENTITY | void = await this.submitToRepository(submit);

    this.emit(RepositoryFormStore.events.submit, result);

    return result;
  }

  protected async submitToRepository(submit: ENTITY): Promise<ENTITY | void> {
    if (isString(submit.id)) {
      const entity: ENTITY = new this.Entity(submit.toObject());

      if (entity.isEntity()) {
        return await this.repository.update(entity.toObject());
      }
    } else {
      const entity: ENTITY = new this.Entity(submit.toJS());

      if (entity.canBeInsert()) {
        return await this.repository.create(entity.toObject());
      }
    }
  }
}