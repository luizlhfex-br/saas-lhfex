import { useState } from "react";
import { Form } from "react-router";
import { Building2, ChevronDown, CreditCard, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";

interface CompanyProfileCardProps {
  company: any;
  isSubmitting: boolean;
  csrfToken: string;
  bankAccounts?: any[];
}

const inputClass =
  "block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100";

const labelClass = "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";
const sectionTitleClass = "mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400";
const stateOptions = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];

function Field(props: { label: string; name: string; defaultValue?: string | null; placeholder?: string; type?: string; wide?: boolean }) {
  return (
    <div className={props.wide ? "sm:col-span-2" : undefined}>
      <label className={labelClass}>{props.label}</label>
      <input
        type={props.type || "text"}
        name={props.name}
        defaultValue={props.defaultValue || ""}
        placeholder={props.placeholder}
        className={inputClass}
      />
    </div>
  );
}

function BankRow({
  bank,
  csrfToken,
  isSubmitting,
  isEditing,
  onEdit,
  onCancel,
}: {
  bank: any;
  csrfToken: string;
  isSubmitting: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
}) {
  if (isEditing) {
    return (
      <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <Form method="post" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input type="hidden" name="csrf" value={csrfToken} />
          <input type="hidden" name="action" value="update_bank_account" />
          <input type="hidden" name="bankId" value={bank.id} />
          <Field label="Banco" name="bankName" defaultValue={bank.bankName} />
          <Field label="Titular" name="accountHolder" defaultValue={bank.accountHolder} />
          <Field label="Agencia" name="bankAgency" defaultValue={bank.bankAgency} />
          <Field label="Conta" name="bankAccount" defaultValue={bank.bankAccount} />
          <Field label="Chave PIX" name="bankPix" defaultValue={bank.bankPix} wide />
          <div className="sm:col-span-2 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={onCancel} className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
              Cancelar
            </button>
            <Button type="submit" loading={isSubmitting}>
              <Save className="h-4 w-4" />
              Salvar
            </Button>
          </div>
        </Form>
        <Form method="post" className="mt-3 flex justify-end">
          <input type="hidden" name="csrf" value={csrfToken} />
          <input type="hidden" name="action" value="delete_bank_account" />
          <input type="hidden" name="bankId" value={bank.id} />
          <button type="submit" className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/20">
            <Trash2 className="h-4 w-4" />
            Excluir conta
          </button>
        </Form>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium text-gray-900 dark:text-gray-100">{bank.bankName}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {bank.accountHolder ? `${bank.accountHolder} - ` : ""}
          Agencia {bank.bankAgency} - Conta {bank.bankAccount}
        </p>
        {bank.bankPix && <p className="text-sm text-gray-500 dark:text-gray-400">PIX: {bank.bankPix}</p>}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onEdit} className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
          Editar
        </button>
        <Form method="post">
          <input type="hidden" name="csrf" value={csrfToken} />
          <input type="hidden" name="action" value="delete_bank_account" />
          <input type="hidden" name="bankId" value={bank.id} />
          <button type="submit" className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/20">
            <Trash2 className="h-4 w-4" />
            Excluir
          </button>
        </Form>
      </div>
    </div>
  );
}

export function CompanyProfileCard({ company, isSubmitting, csrfToken, bankAccounts = [] }: CompanyProfileCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddBank, setShowAddBank] = useState(false);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);

  if (!company) return null;

  const additionalBanks = bankAccounts.filter((bank) => !bank.isDefault);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex cursor-pointer items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-800/50" onClick={() => setIsExpanded((current) => !current)}>
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-gray-500" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{company.nomeFantasia || "Dados cadastrais"}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{company.cnpj || "CNPJ nao configurado"}</p>
          </div>
        </div>
        <button type="button" className="transition-transform" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
          <ChevronDown className="h-5 w-5 text-gray-400" />
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-6 border-t border-gray-200 p-6 dark:border-gray-800">
          <Form method="post" className="space-y-6">
            <input type="hidden" name="csrf" value={csrfToken} />
            <input type="hidden" name="action" value="save_company" />
            <input type="hidden" name="country" value={company?.country || "Brasil"} />

            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
              Se o CNPJ estiver preenchido, o sistema complementa razao social, CNAE e endereco com base no cadastro publico.
            </div>

            <div>
              <p className={sectionTitleClass}>Identificacao</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="CNPJ" name="cnpj" defaultValue={company?.cnpj} placeholder="00.000.000/0001-00" />
                <Field label="Razao social" name="razaoSocial" defaultValue={company?.razaoSocial} placeholder="Nome completo da empresa" />
                <Field label="Nome fantasia" name="nomeFantasia" defaultValue={company?.nomeFantasia} placeholder="Nome comercial" />
              </div>
            </div>

            <div>
              <p className={sectionTitleClass}>Contato</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Contato principal" name="contactName" defaultValue={company?.contactName} placeholder="Nome do responsavel" />
                <Field label="Cargo" name="contactRole" defaultValue={company?.contactRole} placeholder="Funcao principal" />
                <Field label="Registro profissional / assinatura" name="contactRegistration" defaultValue={company?.contactRegistration} placeholder="Ex.: Registro CRA n 00-000000/D | Marca" wide />
                <Field label="E-mail" name="email" defaultValue={company?.email} placeholder="contato@empresa.com.br" type="email" />
                <Field label="Telefone" name="phone" defaultValue={company?.phone} placeholder="+55 31 99999-9999" />
                <Field label="Site" name="website" defaultValue={company?.website} placeholder="https://www.empresa.com.br" type="url" wide />
              </div>
            </div>

            <div>
              <p className={sectionTitleClass}>Endereco</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Logradouro" name="address" defaultValue={company?.address} placeholder="Rua, numero, complemento e bairro" wide />
                <Field label="Cidade" name="city" defaultValue={company?.city} placeholder="Belo Horizonte" />
                <div>
                  <label className={labelClass}>Estado</label>
                  <select name="state" defaultValue={company?.state || "MG"} className={inputClass}>
                    {stateOptions.map((stateCode) => (
                      <option key={stateCode} value={stateCode}>
                        {stateCode}
                      </option>
                    ))}
                  </select>
                </div>
                <Field label="CEP" name="zipCode" defaultValue={company?.zipCode} placeholder="30.130-138" />
              </div>
            </div>

            <div>
              <p className={sectionTitleClass}>Dados fiscais</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="IE" name="ie" defaultValue={company?.ie} placeholder="Inscricao estadual ou Isento" />
                <Field label="IM" name="im" defaultValue={company?.im} placeholder="Inscricao municipal" />
                <Field label="CNAE" name="cnae" defaultValue={company?.cnae} placeholder="7020400" />
                <Field label="Descricao CNAE" name="cnaeDescription" defaultValue={company?.cnaeDescription} placeholder="Descricao do CNAE principal" />
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-gray-400" />
                <p className={sectionTitleClass}>Conta bancaria principal</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Banco" name="bankName" defaultValue={company?.bankName} placeholder="INTER - 077" />
                <Field label="Titular" name="bankHolder" defaultValue={company?.bankHolder} placeholder="Titular da conta" />
                <Field label="Agencia" name="bankAgency" defaultValue={company?.bankAgency} placeholder="0001" />
                <Field label="Conta" name="bankAccount" defaultValue={company?.bankAccount} placeholder="12345678-9" />
                <Field label="Chave PIX" name="bankPix" defaultValue={company?.bankPix} placeholder="CNPJ, email ou telefone" wide />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" loading={isSubmitting}>
                <Save className="h-4 w-4" />
                Salvar alteracoes
              </Button>
            </div>
          </Form>

          <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className={sectionTitleClass}>Contas bancarias adicionais</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Adicione outras contas para PIX, cobranca ou recebimento.</p>
              </div>
              <button type="button" onClick={() => { setShowAddBank((current) => !current); setEditingBankId(null); }} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                <Plus className="h-4 w-4" />
                {showAddBank ? "Cancelar" : "Adicionar conta"}
              </button>
            </div>

            {showAddBank && (
              <Form method="post" className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/60 dark:bg-blue-950/20 sm:grid-cols-2">
                <input type="hidden" name="csrf" value={csrfToken} />
                <input type="hidden" name="action" value="add_bank_account" />
                <Field label="Banco" name="extraBankName" placeholder="Banco / codigo" />
                <Field label="Titular" name="extraAccountHolder" placeholder="Titular da conta" />
                <Field label="Agencia" name="extraBankAgency" placeholder="0001" />
                <Field label="Conta" name="extraBankAccount" placeholder="12345678-9" />
                <Field label="Chave PIX" name="extraBankPix" placeholder="CNPJ, email ou telefone" wide />
                <div className="sm:col-span-2 flex justify-end">
                  <Button type="submit" loading={isSubmitting}>
                    <Save className="h-4 w-4" />
                    Salvar conta adicional
                  </Button>
                </div>
              </Form>
            )}

            {additionalBanks.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma conta adicional cadastrada.</p>
            ) : (
              <div className="space-y-3">
                {additionalBanks.map((bank) => (
                  <BankRow
                    key={bank.id}
                    bank={bank}
                    csrfToken={csrfToken}
                    isSubmitting={isSubmitting}
                    isEditing={editingBankId === bank.id}
                    onEdit={() => {
                      setEditingBankId(bank.id);
                      setShowAddBank(false);
                    }}
                    onCancel={() => setEditingBankId(null)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
