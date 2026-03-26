export type ChannelConnectionStatus = {
  channelId: string;
  connected: boolean;
  peerAddr?: string;
  connectedAt?: string;
  listenAddr: string;
  statusText?: string;
  lastError?: string;
  accountId?: string;
  baseUrl?: string;
  loginSessionKey?: string;
  qrcodeUrl?: string;
};

export type ChannelLogEntry = {
  timestamp: string;
  level: string;
  message: string;
};

export type WeixinLoginStatus = {
  channelId: string;
  connected: boolean;
  status: string;
  message: string;
  sessionKey?: string;
  qrcode?: string;
  qrcodeImgContent?: string;
  accountId?: string;
  userId?: string;
  baseUrl?: string;
  lastError?: string;
};
