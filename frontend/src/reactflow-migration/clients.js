import { ScrybeApiClient } from './apiClient';
import { ScrybeEventsClient } from './eventsClient';

export const apiClient = new ScrybeApiClient();
export const eventsClient = new ScrybeEventsClient(apiClient.baseUrl);
