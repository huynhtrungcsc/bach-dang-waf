/**
 * DTO for updating a replica node
 */
export interface UpdateReplicaDto {
  name?: string;
  host?: string;
  port?: number;
  syncInterval?: number;
  syncEnabled?: boolean;
}
