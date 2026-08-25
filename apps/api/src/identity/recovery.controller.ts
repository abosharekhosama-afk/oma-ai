import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { recoveryService } from './recovery.service';

@Controller('api/v1/auth/recovery')
export class RecoveryController {
  @Post('request')
  @HttpCode(200)
  async request(@Body() body: { email: string }) {
    return recoveryService.request(body.email);
  }

  @Post('confirm')
  @HttpCode(200)
  async confirm(@Body() body: { token: string; password: string }) {
    return recoveryService.confirm(body.token, body.password);
  }
}
