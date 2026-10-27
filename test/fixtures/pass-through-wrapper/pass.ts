// Controller: decorators map HTTP to the service, a different layer even though bodies forward.
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.users.findById(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.users.remove(id);
  }
}

// Renames the API (narrows it): different method names, so it is an adapter, not a pass-through.
export class Storage {
  constructor(private s3: S3Client) {}

  read(key: string) {
    return this.s3.getObject(key);
  }

  write(key: string, body: Buffer) {
    return this.s3.putObject(key, body);
  }
}

export class Repo extends BaseRepo {
  find(id: string) {
    return this.db.find(id);
  }

  save(row: Row) {
    return this.db.save(row);
  }
}
