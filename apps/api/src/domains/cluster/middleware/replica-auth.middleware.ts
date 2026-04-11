import { Response, NextFunction } from 'express';
import logger from '../../../utils/logger';
import { ClusterRepository } from '../cluster.repository';
import { ReplicaRequest } from '../cluster.types';

const repository = new ClusterRepository();

/**
 * Validate Replica API Key
 * Used for replica nodes to authenticate with master
 */
export const validateReplicaApiKey = async (
  req: ReplicaRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      res.status(401).json({
        success: false,
        message: 'API key required'
      });
      return;
    }

    // Find replica node by API key
    const replicaNode = await repository.findByApiKey(apiKey);

    if (!replicaNode) {
      logger.warn('Invalid replica API key attempt', { apiKey: apiKey.substring(0, 8) + '...' });
      res.status(401).json({
        success: false,
        message: 'Invalid API key'
      });
      return;
    }

    if (!replicaNode.syncEnabled) {
      res.status(403).json({
        success: false,
        message: 'Node sync is disabled'
      });
      return;
    }

    // Attach replica node info to request
    req.replicaNode = replicaNode;

    // Update last seen
    await repository.updateLastSeen(replicaNode.id);

    next();
  } catch (error) {
    logger.error('Replica API key validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

/**
 * Validate Master API Key for Node Sync
 * Used when replica nodes pull config from master
 * Updates replica node status when they connect
 */
export const validateMasterApiKey = async (
  req: ReplicaRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = req.headers['x-replica-api-key'] as string;

    if (!apiKey) {
      res.status(401).json({
        success: false,
        message: 'Replica API key required'
      });
      return;
    }

    // Find replica node by API key
    const replicaNode = await repository.findByApiKey(apiKey);

    if (!replicaNode) {
      logger.warn('[NODE-SYNC] Invalid replica API key attempt', {
        apiKey: apiKey.substring(0, 8) + '...'
      });
      res.status(401).json({
        success: false,
        message: 'Invalid API key'
      });
      return;
    }

    if (!replicaNode.syncEnabled) {
      res.status(403).json({
        success: false,
        message: 'Node sync is disabled'
      });
      return;
    }

    // Attach replica node info to request
    req.replicaNode = replicaNode;

    // Update last seen and status to online
    await repository.updateLastSeenAndStatus(replicaNode.id, new Date(), 'online');

    logger.info('[NODE-SYNC] Replica node authenticated', {
      nodeId: replicaNode.id,
      nodeName: replicaNode.name
    });

    next();
  } catch (error: any) {
    logger.error('[REPLICA-AUTH] Validate master API key error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};
