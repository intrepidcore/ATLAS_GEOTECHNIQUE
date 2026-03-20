import { createRoot, Root } from 'react-dom/client';
import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import { missionsApi } from '../services/colab-api';

type ModalType = 'create-mission' | 'transfer-mission';

type ModalRequest =
  | {
      type: 'create-mission';
      mailleCode?: string;
      onDone?: () => void;
    }
  | {
      type: 'transfer-mission';
      missionId: string;
      onDone?: () => void;
    };

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let openImpl: ((req: ModalRequest) => void) | null = null;
let closeImpl: (() => void) | null = null;

let pendingRequest: ModalRequest | null = null;

const CreateMissionModal = React.lazy(() => import('../pages/colab/create-mission-modal'));
const TransferMissionModal = React.lazy(() => import('../pages/colab/transfer-mission-modal'));

const Host: React.FC = () => {
  const [req, setReq] = useState<ModalRequest | null>(null);
  const [transferMissionLoading, setTransferMissionLoading] = useState(false);
  const [transferMission, setTransferMission] = useState<any | null>(null);

  const close = useCallback(() => setReq(null), []);

  const open = useCallback((r: ModalRequest) => setReq(r), []);

  useEffect(() => {
    if (!container) return;
    container.style.pointerEvents = req ? 'auto' : 'none';
  }, [req]);

  useEffect(() => {
    let cancelled = false;
    if (!req || req.type !== 'transfer-mission') {
      setTransferMission(null);
      setTransferMissionLoading(false);
      return;
    }
    setTransferMission(null);
    setTransferMissionLoading(true);
    missionsApi
      .get(req.missionId)
      .then(m => {
        if (cancelled) return;
        setTransferMission({
          id: m.id,
          code: (m as any).code,
          title: (m as any).title,
        });
      })
      .finally(() => {
        if (!cancelled) setTransferMissionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [req]);

  const createMissionProps = useMemo(() => {
    if (!req || req.type !== 'create-mission') return null;
    return {
      isOpen: true,
      onClose: close,
      onCreated: () => {
        req.onDone?.();
        close();
      },
      initialMailleQuery: req.mailleCode,
    };
  }, [close, req]);

  const transferMissionProps = useMemo(() => {
    if (!req || req.type !== 'transfer-mission') return null;
    return {
      isOpen: true,
      mission: transferMission,
      onClose: close,
      onTransferred: () => {
        req.onDone?.();
        close();
      },
    };
  }, [close, req, transferMission]);

  openImpl = open;
  closeImpl = close;

  // Flush pending request (premier tick après mount)
  useEffect(() => {
    if (!pendingRequest) return;
    const r = pendingRequest;
    pendingRequest = null;
    open(r);
  }, [open]);

  if (!req) return null;

  if (req.type === 'transfer-mission' && transferMissionLoading) {
    return null;
  }

  return React.createElement(
    Suspense,
    { fallback: null },
    req.type === 'create-mission' && createMissionProps
      ? React.createElement(CreateMissionModal as any, createMissionProps as any)
      : null,
    req.type === 'transfer-mission' && transferMissionProps
      ? React.createElement(TransferMissionModal as any, transferMissionProps as any)
      : null,
  );
};

function ensureMounted() {
  if (container && root) return;
  container = document.createElement('div');
  container.id = 'atlas-react-modal-host';
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.zIndex = '9999';
  container.style.pointerEvents = 'none';
  document.body.appendChild(container);
  root = createRoot(container);
  root.render(React.createElement(Host));
}

export function openCreateMissionModal(opts: { mailleCode?: string; onDone?: () => void }) {
  ensureMounted();
  const req: ModalRequest = { type: 'create-mission', mailleCode: opts.mailleCode, onDone: opts.onDone };
  if (openImpl) {
    openImpl(req);
  } else {
    pendingRequest = req;
    queueMicrotask(() => {
      if (openImpl && pendingRequest === req) {
        pendingRequest = null;
        openImpl(req);
      }
    });
  }
}

export function openTransferMissionModal(opts: { missionId: string; onDone?: () => void }) {
  ensureMounted();
  const req: ModalRequest = { type: 'transfer-mission', missionId: opts.missionId, onDone: opts.onDone };
  if (openImpl) {
    openImpl(req);
  } else {
    pendingRequest = req;
    queueMicrotask(() => {
      if (openImpl && pendingRequest === req) {
        pendingRequest = null;
        openImpl(req);
      }
    });
  }
}

export function closeReactModalHost() {
  closeImpl?.();
}
