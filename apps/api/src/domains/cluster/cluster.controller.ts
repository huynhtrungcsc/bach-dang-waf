import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { ReplicaRequest } from './cluster.types';
import { clusterService } from './cluster.service';
import logger from '../../utils/logger';
export const registerReplicaNode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, host, port, syncInterval } = req.body;

    const result = await clusterService.registerReplicaNode(
      { name, host, port, syncInterval },
      req.user?.userId
    );

    res.status(201).json({
      success: true,
      message: 'Replica node registered successfully',
      data: result
    });
  } catch (error: any) {
    logger.error('Register replica node error:', error);
    res.status(error.message === 'Replica node with this name already exists' ? 400 : 500).json({
      success: false,
      message: error.message || 'Failed to register replica node'
    });
  }
};
export const getReplicaNodes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const nodes = await clusterService.getAllSlaveNodes();

    res.json({
      success: true,
      data: nodes
    });
  } catch (error) {
    logger.error('Get replica nodes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get replica nodes'
    });
  }
};
export const getReplicaNode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const node = await clusterService.getReplicaNodeById(id);

    res.json({
      success: true,
      data: node
    });
  } catch (error: any) {
    logger.error('Get replica node error:', error);
    res.status(error.message === 'Replica node not found' ? 404 : 500).json({
      success: false,
      message: error.message || 'Failed to get replica node'
    });
  }
};
export const deleteReplicaNode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await clusterService.deleteReplicaNode(id, req.user?.userId);

    res.json({
      success: true,
      message: 'Replica node deleted successfully'
    });
  } catch (error) {
    logger.error('Delete replica node error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete replica node'
    });
  }
};
export const healthCheck = async (req: ReplicaRequest, res: Response): Promise<void> => {
  try {
    const data = await clusterService.healthCheck(
      req.replicaNode?.id,
      req.replicaNode?.name
    );

    res.json({
      success: true,
      message: 'Replica node is healthy',
      data
    });
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({
      success: false,
      message: 'Health check failed'
    });
  }
};
