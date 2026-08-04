import type { NextFunction, Request, Response } from 'express';
import { httpsEnforcement } from './https-enforcement';

function responseMock() {
  const response = {
    status: jest.fn(),
    setHeader: jest.fn(),
    json: jest.fn(),
  };
  response.status.mockReturnValue(response);
  response.setHeader.mockReturnValue(response);
  return response;
}

describe('httpsEnforcement', () => {
  it('rejects insecure requests when enforcement is enabled', () => {
    const middleware = httpsEnforcement({ enabled: true, trustProxy: false });
    const response = responseMock();
    const next = jest.fn();

    middleware(
      { secure: false, headers: {} } as Request,
      response as unknown as Response,
      next as NextFunction,
    );

    expect(response.status).toHaveBeenCalledWith(426);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 426,
      message: 'HTTPS is required.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts TLS reported by a trusted proxy', () => {
    const middleware = httpsEnforcement({ enabled: true, trustProxy: true });
    const next = jest.fn();

    middleware(
      {
        secure: false,
        headers: { 'x-forwarded-proto': 'https, http' },
      } as unknown as Request,
      responseMock() as unknown as Response,
      next as NextFunction,
    );

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('ignores forwarded protocol headers from untrusted clients', () => {
    const middleware = httpsEnforcement({ enabled: true, trustProxy: false });
    const response = responseMock();
    const next = jest.fn();

    middleware(
      {
        secure: false,
        headers: { 'x-forwarded-proto': 'https' },
      } as unknown as Request,
      response as unknown as Response,
      next as NextFunction,
    );

    expect(response.status).toHaveBeenCalledWith(426);
    expect(next).not.toHaveBeenCalled();
  });
});
