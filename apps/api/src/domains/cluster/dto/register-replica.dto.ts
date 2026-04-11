/**
 * DTO for registering a new replica node
 */
export interface RegisterReplicaDto {
  name: string;
  host: string;
  port?: number;
  syncInterval?: number;
}
