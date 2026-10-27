import { UserRepository } from './user.repository';

export class UserService { // expect: pass-through-wrapper
  constructor(private readonly users: UserRepository) {}

  async findById(id: string): Promise<User | null> {
    return this.users.findById(id);
  }

  async create(input: CreateUser): Promise<User> {
    return await this.users.create(input);
  }

  remove(id: string) {
    return this.users.remove(id);
  }
}
