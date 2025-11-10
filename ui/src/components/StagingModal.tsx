// Modal Staging - Interface complète pour édition de tables
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, CheckCircle, XCircle, Lock } from 'lucide-react';

interface StagingModalProps {
  open: boolean;
  onClose: () => void;
  schema: string;
  table: string;
  user: string;
  userEmail?: string;
}

interface StagingInfo {
  staging_id: string;
  table_name: string;
  schema_name: string;
  created_at: string;
  reason?: string;
  row_count: number;
  operations_count: number;
}

interface StagingLock {
  table_name: string;
  locked_by: string;
  user_email?: string;
  locked_at: string;
  expires_at: string;
  staging_id?: string;
  reason?: string;
}

interface DryRunResult {
  is_safe: boolean;
  conflicts: ConflictDetail[];
  warnings: string[];
  estimated_duration_ms?: number;
  affected_rows: number;
}

interface ConflictDetail {
  conflict_type: string;
  table: string;
  column?: string;
  constraint_name?: string;
  affected_rows: number;
  sample_values: string[];
}

export const StagingModal: React.FC<StagingModalProps> = ({
  open,
  onClose,
  schema,
  table,
  user,
  userEmail,
}) => {
  const [stagingInfo, setStagingInfo] = useState<StagingInfo | null>(null);
  const [lockInfo, setLockInfo] = useState<StagingLock | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [showDryRun, setShowDryRun] = useState(false);
  const [activeTab, setActiveTab] = useState('data');

  // Créer le staging au montage
  useEffect(() => {
    if (open && !stagingInfo) {
      createStaging();
    }
  }, [open]);

  const createStaging = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/db/staging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema,
          table,
          reason: `Édition par ${user}`,
          copy_data: false,
          user,
          user_email: userEmail,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Erreur création staging');
        if (data.lock_info) {
          setLockInfo(data.lock_info);
        }
        return;
      }

      setStagingInfo(data.staging_info);
      setLockInfo(data.lock_info);
    } catch (err) {
      setError(`Erreur réseau: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const runDryRun = async () => {
    if (!stagingInfo) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/db/staging/${stagingInfo.staging_id}/dryrun`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setDryRunResult(data.result);
        setShowDryRun(true);
      } else {
        setError(data.error || 'Erreur dry-run');
      }
    } catch (err) {
      setError(`Erreur réseau: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const commitStaging = async () => {
    if (!stagingInfo) return;

    // Confirmation
    if (!confirm(`Confirmer le commit de ${stagingInfo.row_count} lignes ?`)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/db/staging/${stagingInfo.staging_id}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Commit staging ${stagingInfo.staging_id}`,
          user,
          backup: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Erreur commit');
        return;
      }

      // Succès
      alert('Commit réussi !');
      onClose();
    } catch (err) {
      setError(`Erreur réseau: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const cancelStaging = async () => {
    if (!stagingInfo) return;

    if (!confirm('Annuler toutes les modifications ?')) {
      return;
    }

    setLoading(true);

    try {
      await fetch(`/api/db/staging/${stagingInfo.staging_id}/cancel`, {
        method: 'POST',
      });

      onClose();
    } catch (err) {
      setError(`Erreur réseau: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Mode Édition: {schema}.{table}
            {lockInfo && (
              <Badge variant="outline" className="ml-2">
                <Lock className="w-3 h-3 mr-1" />
                Verrouillé
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Bannière mode édition */}
        {stagingInfo && (
          <Alert className="bg-orange-50 border-orange-200">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              Mode Édition Actif - Modifications non commitées
              {lockInfo && (
                <span className="ml-2">
                  • Expire: {new Date(lockInfo.expires_at).toLocaleTimeString()}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}

        {/* Contenu principal */}
        {stagingInfo && !loading && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList>
              <TabsTrigger value="data">Données</TabsTrigger>
              <TabsTrigger value="changes">Changements ({stagingInfo.operations_count})</TabsTrigger>
              <TabsTrigger value="preview">Preview SQL</TabsTrigger>
            </TabsList>

            <TabsContent value="data" className="flex-1 overflow-auto">
              <div className="border rounded p-4">
                <p className="text-sm text-gray-600">
                  DataGrid éditable ici (intégration AG-Grid ou TanStack Table)
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Staging ID: {stagingInfo.staging_id}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="changes" className="flex-1 overflow-auto">
              <div className="border rounded p-4">
                <p className="text-sm text-gray-600">
                  Liste des modifications (INSERT/UPDATE/DELETE)
                </p>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="flex-1 overflow-auto">
              <div className="border rounded p-4 bg-gray-50 font-mono text-sm">
                <p className="text-gray-600">Preview SQL des changements</p>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Dry-Run Result Modal */}
        {showDryRun && dryRunResult && (
          <div className="border rounded p-4 bg-blue-50">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              {dryRunResult.is_safe ? (
                <>
                  <CheckCircle className="text-green-600" />
                  Dry-Run: Sûr
                </>
              ) : (
                <>
                  <AlertTriangle className="text-red-600" />
                  Dry-Run: Conflits Détectés
                </>
              )}
            </h3>

            <div className="space-y-2 text-sm">
              <p>Lignes affectées: {dryRunResult.affected_rows}</p>
              {dryRunResult.estimated_duration_ms && (
                <p>Durée estimée: {dryRunResult.estimated_duration_ms}ms</p>
              )}

              {dryRunResult.conflicts.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold text-red-700">Conflits:</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    {dryRunResult.conflicts.map((conflict, idx) => (
                      <li key={idx}>
                        {conflict.conflict_type} sur {conflict.column || conflict.table}
                        ({conflict.affected_rows} lignes)
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {dryRunResult.warnings.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold text-orange-700">Warnings:</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    {dryRunResult.warnings.map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setShowDryRun(false)}
            >
              Fermer
            </Button>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={cancelStaging} disabled={loading}>
            Annuler
          </Button>
          <Button variant="secondary" onClick={runDryRun} disabled={loading}>
            {loading ? <Loader2 className="animate-spin mr-2" /> : null}
            Dry-Run
          </Button>
          <Button
            onClick={commitStaging}
            disabled={loading || (dryRunResult && !dryRunResult.is_safe)}
          >
            {loading ? <Loader2 className="animate-spin mr-2" /> : null}
            Commit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
