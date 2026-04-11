import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import logger from '../../utils/logger';
import { validationResult } from 'express-validator';
import { sslService } from './ssl.service';
import { IssueAutoSSLDto, UploadManualSSLDto, UpdateSSLDto } from './dto';
import { acmeService } from './services/acme.service';
export const getSSLSystemInfo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const defaultCA = acmeService.getDefaultCA();
    const isAcmeInstalled = await acmeService.isAcmeInstalled();

    res.json({
      success: true,
      data: {
        defaultCA,
        caServerOptions: ['zerossl', 'letsencrypt'],
        isAcmeInstalled,
        supportedIssuers: ['ZeroSSL', "Let's Encrypt"],
      },
    });
  } catch (error) {
    logger.error('Get SSL system info error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
export const getSSLCertificates = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const certificates = await sslService.listCerts();

    res.json({
      success: true,
      data: certificates,
    });
  } catch (error) {
    logger.error('Get SSL certificates error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
export const getSSLCertificate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const certificate = await sslService.findCert(id);

    if (!certificate) {
      res.status(404).json({
        success: false,
        message: 'SSL certificate not found',
      });
      return;
    }

    res.json({
      success: true,
      data: certificate,
    });
  } catch (error) {
    logger.error('Get SSL certificate error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
export const issueAutoSSL = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        errors: errors.array(),
      });
      return;
    }

    const dto: IssueAutoSSLDto = {
      domainId: req.body.domainId,
      email: req.body.email,
      autoRenew: req.body.autoRenew ?? true,
    };

    try {
      const sslCertificate = await sslService.issueAutoSSL(
        dto,
        req.user!.userId,
        req.ip || 'unknown',
        req.headers['user-agent'] || 'unknown'
      );

      res.status(201).json({
        success: true,
        message: 'SSL certificate issued successfully',
        data: sslCertificate,
      });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message,
        });
      } else if (error.message.includes('already exists') || error.message.includes('Invalid email')) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          message: error.message,
        });
      }
    }
  } catch (error) {
    logger.error('Issue auto SSL error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
export const uploadManualSSL = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        errors: errors.array(),
      });
      return;
    }

    const dto: UploadManualSSLDto = {
      domainId: req.body.domainId,
      certificate: req.body.certificate,
      privateKey: req.body.privateKey,
      chain: req.body.chain,
      issuer: req.body.issuer,
    };

    try {
      const cert = await sslService.uploadManualSSL(
        dto,
        req.user!.userId,
        req.ip || 'unknown',
        req.headers['user-agent'] || 'unknown'
      );

      res.status(201).json({
        success: true,
        message: 'SSL certificate uploaded successfully',
        data: cert,
      });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message,
        });
      } else if (error.message.includes('already exists') || error.message.includes('Use update endpoint')) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          message: error.message,
        });
      }
    }
  } catch (error) {
    logger.error('Upload manual SSL error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
export const updateSSLCertificate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        errors: errors.array(),
      });
      return;
    }

    const { id } = req.params;
    const dto: UpdateSSLDto = {
      certificate: req.body.certificate,
      privateKey: req.body.privateKey,
      chain: req.body.chain,
      autoRenew: req.body.autoRenew,
    };

    try {
      const updatedCert = await sslService.editCert(
        id,
        dto,
        req.user!.userId,
        req.ip || 'unknown',
        req.headers['user-agent'] || 'unknown'
      );

      res.json({
        success: true,
        message: 'SSL certificate updated successfully',
        data: updatedCert,
      });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          message: error.message,
        });
      }
    }
  } catch (error) {
    logger.error('Update SSL certificate error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
export const deleteSSLCertificate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    try {
      await sslService.removeCert(
        id,
        req.user!.userId,
        req.ip || 'unknown',
        req.headers['user-agent'] || 'unknown'
      );

      res.json({
        success: true,
        message: 'SSL certificate deleted successfully',
      });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          message: error.message,
        });
      }
    }
  } catch (error) {
    logger.error('Delete SSL certificate error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
export const renewSSLCertificate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    try {
      const updatedCert = await sslService.renewCert(
        id,
        req.user!.userId,
        req.ip || 'unknown',
        req.headers['user-agent'] || 'unknown'
      );

      res.json({
        success: true,
        message: 'SSL certificate renewed successfully',
        data: updatedCert,
      });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message,
        });
      } else if (error.message.includes('Only Let')) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
      } else if (error.message.includes('not yet eligible')) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          message: error.message,
        });
      }
    }
  } catch (error) {
    logger.error('Renew SSL certificate error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
