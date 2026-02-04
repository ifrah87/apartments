export type Language = "en" | "so";

export type TranslationTree = {
  [key: string]: string | TranslationTree | undefined;
};

type Replacements = Record<string, string | number>;

export const TRANSLATIONS: Record<Language, TranslationTree> = {
  en: {
    common: {
      never: "Never",
      viewAll: "View all",
      viewLess: "View less",
      open: "Open",
    },
    language: {
      label: "Language",
      english: "English",
      somali: "Somali",
    },
    header: {
      alertsTitle: "Alerts & Notifications",
      alertsEmpty: "No alerts · No notifications",
    },
    sidebar: {
      nav: {
        dashboard: "Dashboard",
        properties: "Properties",
        tenants: "Tenants",
        onboarding: "Onboarding",
        commercial: "Commercial Space",
        readings: "Readings",
        bills: "Bills",
        admin: "Admin",
        sop: "SOP",
        houseRules: "House Rules",
        reports: "Reports & Analytics",
        integrations: "Integrations",
        contacts: "Contacts",
      },
      bankSync: "Bank sync:",
      bankUpdated: "Updated 2m ago",
    },
    dashboard: {
      title: "Dashboard",
      subtitle: "Revenue health, risk signals, and recent activity in one view.",
      bankBalance: "Bank balance",
      viewReport: "View report",
      unreconciledSingle: "{count} unreconciled item",
      unreconciledPlural: "{count} unreconciled items",
      lastSynced: "Last synced: {timestamp}",
      stats: {
        rentCollected: "Rent Collected (MTD)",
        upcoming: "Upcoming Payments",
        overdue: "Overdue Rent",
        upcomingSubtitle: "{count} payments due in 7 days",
        overdueSubtitle: "{count} tenants overdue",
        tenantsAtRisk: "Tenants at risk",
        tenantsAtRiskSubtitle: "Rent at risk: {amount}",
        occupancyRate: "Occupancy rate",
        occupancySubtitle: "{occupied}/{total} occupied",
        turnover: "Tenant turnover",
        turnoverSubtitle: "{count} move-outs (12m)",
      },
      cashBadge: "Cash In & Out",
      cashTitle: "Monthly cashflow",
      overdueTitle: "Overdue rent",
      atRiskTitle: "Tenants at risk",
      recentPayments: "Recent payments",
      paymentsIn: "Payments in",
      paymentsOut: "Payments out",
      emptyOverdue: "No overdue tenants in this period.",
      emptyAtRisk: "No at-risk tenants in this period.",
      emptyRecent: "No recent activity.",
      summaryLabel: "Summary",
      summaryTenants: "tenants",
      table: {
        tenant: "Tenant",
        unit: "Unit",
        balance: "Balance",
        daysLate: "Days late",
        dueDate: "Due date",
        paidDate: "Paid date",
        lateMonths: "Late months",
      },
      atRiskRule: "At risk = paid after the due date in 4+ months over the last 12 months (bank received date).",
    },
    cashflow: {
      title: "Cash in and out",
      cashIn: "Cash in",
      cashOut: "Cash out",
      difference: "Difference",
      rangeMonthly: "Monthly",
      rangeQuarterly: "Quarterly",
      rangeYearly: "Yearly",
      yearRangeLabel: "Last 12 months",
      tooltipIn: "In",
      tooltipOut: "Out",
      tooltipDiff: "Diff",
      legendIn: "Cash in",
      legendOut: "Cash out",
      viewDetails: "View detailed cashflow →",
    },
    properties: {
      title: "Properties",
      description: "Overview, units, and tenants per building pulled straight from the CSV data.",
      searchPlaceholder: "Search building, unit, or tenant",
      tenantsLoaded: "{count} tenants loaded",
      buildingFallback: "Building {id}",
      headerLine: "{total} units · {occupied} occupied · {vacant} vacant",
      tabs: {
        overview: "Overview",
        units: "Units",
        tenants: "Tenants",
      },
      summary: {
        totalUnits: "Total Units",
        totalHint: "From properties CSV",
        occupied: "Occupied",
        vacant: "Vacant",
        autoCalc: "Auto-calculated",
        monthlyRent: "Monthly Rent",
        rentHint: "Sum of tenant rent",
      },
      unitsList: "Units list",
      tenantList: "Tenant list",
      table: {
        unit: "Unit",
        tenant: "Tenant",
        rent: "Rent",
        dueDay: "Due Day",
        status: "Status",
      },
      statusOccupied: "Occupied",
      vacantLabel: "{count} Vacant",
      vacantUnits: "Vacant units",
      noTenants: "No tenants listed in CSV for this property.",
    },
    tenants: {
      badge: "Leases & Statements",
      title: "Leases & Statements",
      subtitle: "Manage leases, statements, and draft invoices in one place.",
      searchPlaceholder: "Search tenant or unit",
      noMatch: "No tenants match that search.",
      selectedTenant: "Selected tenant",
      monthlyRent: "Monthly rent",
      dueDay: "Due day {day}",
      unitLabel: "Unit",
      perMonth: "{amount} / mo",
      leaseCardTitle: "Lease",
      leaseCardDesc: "Download the latest signed lease copy.",
      downloadLease: "Download lease",
      statementCardTitle: "Statement of Account",
      statementCardDesc: "Charges, payments, and balance at a glance.",
      exportCsv: "Export CSV",
      invoiceCardTitle: "Invoice",
      invoiceCardDesc: "Draft current charges before sending.",
      smsCardTitle: "Late Rent Reminder",
      smsCardDesc: "Send a gentle SMS reminder for past-due rent.",
      smsSend: "Send reminder",
      smsSending: "Sending...",
      smsSent: "Reminder sent.",
      smsMissingPhone: "No phone number on file for this tenant.",
      smsError: "Unable to send SMS. Check Twilio settings.",
      generateInvoices: "Generate invoices",
      generatingInvoices: "Generating...",
      invoiceError: "Unable to generate invoices. Try again.",
      totals: {
        charges: "Charges",
        payments: "Payments",
        balance: "Balance",
      },
      statementActivity: "Ledger activity",
      statementHelper: "Select a date window to refresh the ledger.",
      start: "Start",
      end: "End",
      loading: "Loading statement...",
      errorRange: "Start date must be before end date.",
      errorGeneric: "Unable to fetch tenant statement. Try another range.",
      table: {
        date: "Date",
        type: "Type",
        description: "Description",
        charge: "Charge",
        payment: "Payment",
        balance: "Balance",
      },
      noActivity: "No activity for this period.",
      selectForDetails: "Select a tenant to view statement details.",
      selectFromList: "Select a tenant from the list to load the portal view.",
    },
    lease: {
      documentLabel: "Lease/Rental Agreement",
      statePlaceholder: "",
      heading: "Lease Agreement",
      revisionPrefix: "Rev.",
      intro:
        'This Lease Agreement ("Agreement") is made this {date} by and between {landlord}, whose mailing address is {address} (the "Landlord"), and {tenant} (the "Tenant"). Landlord and Tenant may each be referred to as a "Party" or collectively as the "Parties".',
      sections: {
        parties: "Parties & Premises",
        financial: "Financial Terms",
      },
      table: {
        leaseNumber: "Lease number",
        premises: "Premises",
        tenant: "Tenant",
        landlord: "Landlord",
        monthlyRent: "Monthly rent",
        rentDue: "Rent due",
      },
      financial: {
        charges: "Charges",
        deposit: "Security deposit (3 months rent)",
        debit: "Debit",
        credit: "Credit",
        statementWindow: "Statement window: {period}",
        monthlyRent: "Monthly Rent",
        rentDue: "Rent Due",
        dueEachMonth: "Day {day} each month",
      },
      clauses: {
        premises: {
          title: "1. Premises.",
          body:
            'The premises leased is described above and includes all fixtures, parking, and common areas appurtenant thereto (collectively, the "Premises").',
        },
        agreement: {
          title: "2. Agreement to Lease.",
          body:
            "Landlord agrees to lease the Premises to Tenant and Tenant agrees to lease from Landlord, under the terms and conditions of this Agreement.",
        },
        term: {
          title: "3. Term.",
          body:
            "This Agreement runs month-to-month beginning on the possession date and renews automatically unless either Party provides thirty (30) days written notice.",
        },
        rent: {
          title: "4. Rent.",
          body:
            "Rent will be payable in advance and due on day {day} of each month in U.S. Dollars at the address designated by Landlord or via the resident portal.",
        },
        initialPayments: {
          title: "4a. Initial Payments.",
          body:
            "Upon execution, Tenant shall pay the first month rent and any security deposit due. Security deposits are held pursuant to applicable state statutes.",
        },
        guaranty: {
          title: "5. Guaranty.",
          body: "Any guarantor remains jointly and severally liable for Tenant obligations until this Agreement is lawfully terminated.",
        },
        lateFee: {
          title: "6. Late Fee.",
          body:
            "If rent is not received within five (5) days of the due date, Tenant agrees to pay a late charge of 5% of the monthly rent plus any applicable statutory fees.",
        },
        additionalRent: {
          title: "7. Additional Rent.",
          body:
            "Charges for damages, utilities, court costs, or other obligations owed to Landlord become Additional Rent and are due with the next rent installment.",
        },
        utilities: {
          title: "8. Utilities.",
          body:
            "Unless otherwise stated in writing, Tenant is responsible for payment of all utilities and municipal services for the Premises.",
        },
        notices: {
          title: "Notices.",
          body:
            "Official notices to Landlord shall be sent to {address}. Tenant notices shall be sent to the Premises or the mailing address on record.",
        },
      },
      signatures: {
        tenant: "Tenant",
        landlord: "Landlord / Agent",
      },
      footer: "{company} · {address} · {email} · {phone}",
    },
    reports: {
      title: "Reports & Analytics",
      subtitle: "Access standard reports or create a custom view.",
      buildCustom: "Build custom report",
      viewAll: "View all reports",
      searchPlaceholder: "Search reports…",
      backToSummary: "Back to summary",
      quickActions: "Quick actions",
      exportCentre: "Export centre",
      scheduleReport: "Schedule report",
      recentReports: "Recent reports",
      favorites: "Pinned reports",
      favoritesHint: "Quick access to starred reports.",
      noRecent: "No recent reports yet.",
      noFavorites: "No pinned reports yet.",
      pinned: "Pinned",
      pin: "Pin report",
      unpin: "Unpin report",
      today: "Today",
      yesterday: "Yesterday",
      filters: {
        all: "All",
        banking: "Banking",
        accounting: "Accounting",
        rent: "Rent",
        property: "Property",
      },
      groups: {
        banking: {
          title: "Banking",
          desc: "Cash movement, reconciliation, and statement imports.",
          items: {
            bankSummary: { name: "Bank Summary", desc: "Cash in/out overview" },
            accountTransactions: { name: "Account Transactions", desc: "Full ledger export" },
            pnl: { name: "Profit & Loss", desc: "Income vs expense per property." },
            bankImports: { name: "Bank Imports", desc: "Matched vs unmatched statements." },
            bankReconciliation: { name: "Bank Reconciliation", desc: "Book balance vs bank balance." },
            manualPayments: { name: "Manual Payments", desc: "Record off-bank tenant receipts." },
          },
        },
        accounting: {
          title: "Accounting",
          desc: "Financial statements, ledger, and journals.",
          items: {
            balanceSheet: { name: "Balance Sheet", desc: "Assets vs liabilities snapshot." },
            cashflow: { name: "Cashflow", desc: "Movement of cash by activity." },
            trialBalance: { name: "Trial Balance", desc: "Debits vs credits per account." },
            generalLedger: { name: "General Ledger", desc: "Account-by-account journal." },
            journalEntries: { name: "Journal Entries", desc: "Posted entries & adjustments." },
            chartOfAccounts: { name: "Chart of Accounts", desc: "Account reference list." },
          },
        },
        rent: {
          title: "Rent Payments",
          desc: "Collections, adjustments, and deposit tracking.",
          items: {
            rentRoll: { name: "Rent Roll", desc: "Live rent vs payments snapshot." },
            rentLedger: { name: "Rent Ledger", desc: "Payments received vs due." },
            overdueRent: { name: "Overdue Rent", desc: "Delinquent tenants & arrears." },
            rentCharges: { name: "Rent Charges", desc: "Scheduled adjustments." },
            deposits: { name: "Deposits", desc: "Balances held vs released." },
          },
        },
        property: {
          title: "Property Management",
          desc: "Operations across units, leases, and vendors.",
          items: {
            occupancy: { name: "Vacancy & Occupancy", desc: "Track unit availability & days vacant." },
            leaseExpiry: { name: "Lease Expiry", desc: "Leases expiring soon." },
            tenantLedger: { name: "Tenant Ledger", desc: "All tenant payments & notes." },
            unitFinancials: { name: "Unit Financials", desc: "Income vs expense per unit." },
            maintenance: { name: "Maintenance", desc: "Tickets & resolution stats." },
            utilityCharges: { name: "Utility Charges", desc: "Water & electricity billing audit." },
            ownerSummary: { name: "Owner Summary", desc: "Rent, expenses, and net income per owner." },
            kpiDashboard: { name: "KPI Dashboard", desc: "Occupancy, arrears, and profitability KPIs." },
            monthEnd: { name: "Month-End Close", desc: "Checklist status across properties." },
            supplierDirectory: { name: "Supplier Directory", desc: "Vendors & contact info." },
          },
        },
      },
    },
    skyCafe: {
      title: "Sky Café",
      subtitle: "Welcome to the Sky Café dashboard.",
    },
    integrations: {
      title: "Data Integrations",
      subtitle: "Download the latest CSV exports powering this workspace.",
      updatedLabel: "Last modified",
      sizeLabel: "File size",
      statusLabel: "Status",
      checkedLabel: "Checked at",
      statusActive: "Active · file found",
      statusMissing: "Missing · file not found",
      download: "Download CSV",
      empty: "No CSV files found.",
      filenameLabel: "File name",
      files: {
        bank_all_buildings_simple: {
          label: "Bank transactions (simple)",
          desc: "Feeds ledger, payments, and tenant statements.",
        },
        bank_balances: {
          label: "Daily bank balances",
          desc: "Used for dashboard balance and bank summary.",
        },
        bank_import_summary: {
          label: "Bank import summary",
          desc: "Supports reconciliation and matching reports.",
        },
        bank_reconciliation_items: {
          label: "Bank reconciliation items",
          desc: "Lists unreconciled items for accounting reports.",
        },
        deposit_transactions: {
          label: "Deposit transactions",
          desc: "Used in deposit flow and reporting.",
        },
        journal_entries: {
          label: "Journal entries",
          desc: "Feeds accounting export endpoints.",
        },
        kpi_dashboard: {
          label: "KPI dashboard metrics",
          desc: "Source for the KPI reporting widgets.",
        },
        maintenance_tickets: {
          label: "Maintenance tickets",
          desc: "Used in maintenance report/API.",
        },
        month_end_tasks: {
          label: "Month-end tasks",
          desc: "Drives the month-end checklist status.",
        },
        monthly_owner_summary: {
          label: "Monthly owner summary",
          desc: "Feeds owner statement exports.",
        },
        properties_all_buildings: {
          label: "Properties master list",
          desc: "Backs the properties page/API.",
        },
        tenant_charges: {
          label: "Tenant charges",
          desc: "Used in tenant statements.",
        },
        tenant_deposits: {
          label: "Tenant deposits",
          desc: "Feeds deposit balance APIs.",
        },
        tenants_all_buildings_simple_unique: {
          label: "Tenants master list",
          desc: "Backs tenant portal and reports.",
        },
        unit_expenses: {
          label: "Unit expenses",
          desc: "Used in expense/unit reporting.",
        },
        unit_inventory: {
          label: "Unit inventory",
          desc: "Feeds unit availability APIs.",
        },
        unit_turnover: {
          label: "Unit turnover",
          desc: "Used in turnover reporting.",
        },
        units_master_66: {
          label: "Units master",
          desc: "Backing data for units endpoint.",
        },
      },
    },
  },
  so: {
    common: {
      never: "Waligood",
      viewAll: "Eeg dhammaan",
      viewLess: "Yaree",
      open: "Fur",
    },
    language: {
      label: "Luqad",
      english: "Ingiriisi",
      somali: "Soomaali",
    },
    header: {
      alertsTitle: "Digniino & Ogeysiisyo",
      alertsEmpty: "Ma jiraan digniino ama ogeysiisyo",
    },
    sidebar: {
      nav: {
        dashboard: "Golaha",
        properties: "Hantida",
        tenants: "Deganeyaasha",
        onboarding: "Soo Dhaweyn",
        commercial: "Goob Ganacsi",
        readings: "Akhrisyo",
        bills: "Biilal",
        admin: "Maamul",
        sop: "Hawlgal",
        houseRules: "Xeerarka Guriga",
        reports: "Warbixinno & Falanqayn",
        integrations: "Isdhexgal",
        contacts: "Xiriirrada",
      },
      bankSync: "Isku-dubarid Bangi:",
      bankUpdated: "La cusboonaysiiyay 2 daqiiqo kahor",
    },
    dashboard: {
      title: "Golaha",
      subtitle: "Caafimaadka dakhliga, digniino khatar, iyo dhaqdhaqaaqyo dhowaan ah.",
      bankBalance: "Dheelliga Bangiga",
      viewReport: "Eeg warbixinta",
      unreconciledSingle: "{count} shay aan la isu keenin",
      unreconciledPlural: "{count} shay aan la isu keenin",
      lastSynced: "La cusboonaysiiyay: {timestamp}",
      stats: {
        rentCollected: "Kirada La Ururiyay (Bishan)",
        upcoming: "Bixinta Soo Dhawd",
        overdue: "Kiro Dib U Dhacday",
        upcomingSubtitle: "{count} lacag ayaa ku maqan 7 maalmood gudahood",
        overdueSubtitle: "{count} degane ayaa ka dib dhacay",
        tenantsAtRisk: "Deganeyaasha halista ku jira",
        tenantsAtRiskSubtitle: "Kirada halista ku jirta: {amount}",
        occupancyRate: "Heerka deggenaanshaha",
        occupancySubtitle: "{occupied}/{total} la degay",
        turnover: "Wareegga deganayaasha",
        turnoverSubtitle: "{count} bixitaanno (12b)",
      },
      cashBadge: "Lacag Gashay & Baxday",
      cashTitle: "Soconka lacagta bishii",
      overdueTitle: "Kiro dib u dhacday",
      atRiskTitle: "Deganeyaasha halista ku jira",
      recentPayments: "Lacagihii u dambeeyay",
      paymentsIn: "Lacag gashay",
      paymentsOut: "Lacag baxday",
      emptyOverdue: "Ma jiraan deganeyaasha dib u dhacay muddadan.",
      emptyAtRisk: "Ma jiraan deganeyaasha halista ku jira muddadan.",
      emptyRecent: "Ma jiro dhaqdhaqaaq dhawaan ah.",
      summaryLabel: "Kooban",
      summaryTenants: "degane",
      table: {
        tenant: "Degane",
        unit: "Unug",
        balance: "Hadhaaga",
        daysLate: "Maalmo dib u dhacay",
        dueDate: "Taariikhda bixinta",
        paidDate: "Taariikhda la bixiyay",
        lateMonths: "Bilo dib u dhacay",
      },
      atRiskRule: "Halis = bixinta ka dib taariikhda due-ga 4+ bilood 12-kii bilood ee u dambeeyay (bangiga).",
    },
    cashflow: {
      title: "Lacagta soo gasha iyo baxda",
      cashIn: "Lacag gashay",
      cashOut: "Lacag baxday",
      difference: "Farqiga",
      rangeMonthly: "Bishiiba",
      rangeQuarterly: "Rubuciiba",
      rangeYearly: "Sanadkii",
      yearRangeLabel: "12-kii bilood ee la soo dhaafay",
      tooltipIn: "Gashay",
      tooltipOut: "Baxday",
      tooltipDiff: "Farqi",
      legendIn: "Lacag gashay",
      legendOut: "Lacag baxday",
      viewDetails: "Eeg faahfaahinta socodka →",
    },
    properties: {
      title: "Hantida",
      description: "Guudmar, unugyo, iyo deganeyaasha dhismo kasta oo laga soo qaaday xogta CSV.",
      searchPlaceholder: "Raadi dhismo, unug, ama degane",
      tenantsLoaded: "{count} degane ayaa la raray",
      buildingFallback: "Dhismo {id}",
      headerLine: "{total} unug · {occupied} la degay · {vacant} bannaan",
      tabs: {
        overview: "Guudmar",
        units: "Unugyo",
        tenants: "Deganeyaasha",
      },
      summary: {
        totalUnits: "Wadarta Unugyada",
        totalHint: "Laga helay CSV-ga hantida",
        occupied: "La degay",
        vacant: "Bannaan",
        autoCalc: "Si toos ah loo xisaabiyay",
        monthlyRent: "Kiro Bille ah",
        rentHint: "Wadarta kirada deganeyaasha",
      },
      unitsList: "Liiska unugyada",
      tenantList: "Liiska deganeyaasha",
      table: {
        unit: "Unug",
        tenant: "Degane",
        rent: "Kiro",
        dueDay: "Maalinta la bixiyo",
        status: "Xaalad",
      },
      statusOccupied: "La degay",
      vacantLabel: "{count} bannaan",
      vacantUnits: "Unugyo bannaan",
      noTenants: "Ma jiraan degane ku qoran CSV-ga dhismahan.",
    },
    tenants: {
      badge: "Heshiisyada & Caddeymaha",
      title: "Heshiisyada & Caddeymaha",
      subtitle: "Maamul heshiisyada, bayaannada, iyo faturada qabyada ah hal meel.",
      searchPlaceholder: "Raadi degane ama unug",
      noMatch: "Ma jiraan degane ku habboon raadintan.",
      selectedTenant: "Deganaha la xushay",
      monthlyRent: "Kiro bille ah",
      dueDay: "Maalinta bixinta {day}",
      unitLabel: "Unug",
      perMonth: "{amount} / bishii",
      leaseCardTitle: "Heshiis",
      leaseCardDesc: "Soo dejiso nuqulkii heshiiska ugu dambeeyay.",
      downloadLease: "Soo dejiso heshiiska",
      statementCardTitle: "Bayaanka Xisaabta",
      statementCardDesc: "Eedeymo, lacag bixin, iyo dheelli mar kaliya.",
      exportCsv: "Soo saar CSV",
      invoiceCardTitle: "Factura",
      invoiceCardDesc: "Qor eedaha hadda kahor dirista.",
      generateInvoices: "Samee faturada",
      generatingInvoices: "Wuu diyaarinayaa...",
      invoiceError: "Lama samayn karo faturada. Mar kale isku day.",
      totals: {
        charges: "Eedeymo",
        payments: "Lacago la bixiyay",
        balance: "Dheelli",
      },
      statementActivity: "Hawlaha ledger-ka",
      statementHelper: "Xulo labo taariikh si aad u cusboonaysiiso ledger-ka.",
      start: "Bilow",
      end: "Dhamaad",
      loading: "Bayaanka wuu soo dhacayaa...",
      errorRange: "Taariikhda bilowgu waa inay ka horreyso dhammaadka.",
      errorGeneric: "Bayaanka deganaha lama heli karo. Isku day xilli kale.",
      table: {
        date: "Taariikh",
        type: "Nooc",
        description: "Faahfaahin",
        charge: "Eedeyn",
        payment: "Bixin",
        balance: "Dheelli",
      },
      noActivity: "Ma jiro dhaqdhaqaaq muddadan.",
      selectForDetails: "Dooro degane si aad u aragto faahfaahinta bayaanka.",
      selectFromList: "Dooro degane liiska si aad u furto aragtida.",
    },
    lease: {
      documentLabel: "Heshiis Kiro / Kiraysi",
      statePlaceholder: "",
      heading: "Heshiiska Kiro",
      revisionPrefix: "Nuqul",
      intro:
        'Heshiiskan Kiro ("Heshiis") waxaa la sameeyay {date} dhexdeeda {landlord}, cinwaankeedu waa {address} ("Mulkiilaha"), iyo {tenant} ("Deganaha"). Mulkiilaha iyo Deganaha mid walba waxaa loogu yeeri karaa "Qayb" ama si wadajir ah "Qaybaha".',
      sections: {
        parties: "Dhinacyada & Goobta",
        financial: "Shuruudaha Maaliyadda",
      },
      table: {
        leaseNumber: "Lambarka heshiiska",
        premises: "Goobta",
        tenant: "Degane",
        landlord: "Mulkiile",
        monthlyRent: "Kiro bille ah",
        rentDue: "Maalinta kirada",
      },
      financial: {
        charges: "Eedeymo",
        deposit: "Damaanad (3-bilood kirada)",
        debit: "Debit",
        credit: "Credit",
        statementWindow: "Mudada bayaanka: {period}",
        monthlyRent: "Kiro bille ah",
        rentDue: "Maalinta bixinta",
        dueEachMonth: "Maalinta {day} bishiiba",
      },
      clauses: {
        premises: {
          title: "1. Goobta.",
          body:
            'Goobta heshiiska lagu sheegay waxa ku jira dhammaan qalabka, baarkinka, iyo meelaha guud ee la socda (oo si wadajir ah loogu yeero "Goobta").',
        },
        agreement: {
          title: "2. Heshiiska Kirada.",
          body:
            "Mulkiiluhu wuu kiraynayaa Goobta Deganaha, Deganuhuna wuxuu aqbalayaa inuu kiraysto iyadoo la raacayo shuruudaha Heshiiskan.",
        },
        term: {
          title: "3. Muddada.",
          body:
            "Heshiiskani waa bil-bil oo ka bilaabma taariikhda la wareegidda wuxuuna si toos ah u cusboonaysiiyaa ilaa Qayb ka mid ahi bixiso ogeysiis qoraal ah oo 30 maalmood ah.",
        },
        rent: {
          title: "4. Kirada.",
          body:
            "Kiradu waxay horay u bixi doontaa waxaana la guddoonsiiyaa maalinta {day} bishiiba, lacagta Doollar ee Maraykanka ah, cinwaanka uu Mulkiiluhu tilmaamo ama albaabka deganaha.",
        },
        initialPayments: {
          title: "4a. Lacagaha Hore.",
          body:
            "Marka la saxiixo, Deganuhu wuxuu bixiyaa kirada billowga ah iyo deebaajiga amniga ee loo baahan yahay. Deebaajiyada waxaa loo hayaa si waafaqsan shuruucda gobolka ee khuseeya.",
        },
        guaranty: {
          title: "5. Damaanad.",
          body: "Damaanad qaade kasta wuxuu si wadajir ah iyo si gooni gooni ah uga mas'uul yahay waajibaadka Deganaha ilaa Heshiiskani si sharci ah loo joojiyo.",
        },
        lateFee: {
          title: "6. Ganaaxa Daahitaanka.",
          body:
            "Haddii kirada aan la helin shan (5) maalmood gudahood ka dib maalinta la bixiyo, Deganuhu wuu oggol yahay inuu bixiyo ganaax 5% ah oo kirada bille ah iyo khidmad kasta oo sharci ah.",
        },
        additionalRent: {
          title: "7. Kiro Dheeraad ah.",
          body:
            "Eedeymaha dhaawaca, adeegyada, kharashyada maxkamadda, ama waajibaadka kale ee uu leeyahay Mulkiiluhu waxay noqdaan Kiro Dheeraad ah waxaana la qaadaa marka xigta ee kirada.",
        },
        utilities: {
          title: "8. Adeegyada.",
          body:
            "Haddii si kale aan qoraal loogu sheegin, Deganuhu ayaa mas'uul ka ah bixinta dhammaan adeegyada iyo adeegyada degmada ee Goobta.",
        },
        notices: {
          title: "Ogeysiisyada.",
          body:
            "Ogeysiisyada rasmiga ah ee Mulkiilaha waxaa lagu diraa {address}. Ogeysiisyada Deganaha waxaa lagu diraa Goobta ama cinwaanka boostada ee kaydsan.",
        },
      },
      signatures: {
        tenant: "Degane",
        landlord: "Mulkiile / Wakiil",
      },
      footer: "{company} · {address} · {email} · {phone}",
    },
    reports: {
      title: "Warbixinno & Falanqayn",
      subtitle: "Hel warbixinno caadi ah ama samee aragti gaar ah.",
      buildCustom: "Dhis warbixin gaar ah",
      viewAll: "Eeg dhammaan warbixinno",
      searchPlaceholder: "Raadi warbixinno…",
      backToSummary: "Ku noqo kooban",
      quickActions: "Ficillo degdeg ah",
      exportCentre: "Xarunta dhoofinta",
      scheduleReport: "Jadwal warbixin",
      recentReports: "Warbixinno dhowaan",
      favorites: "Warbixinno la jeclaaday",
      favoritesHint: "Helitaan degdeg ah oo warbixinno la xushay.",
      noRecent: "Weli ma jiraan warbixinno dhowaan.",
      noFavorites: "Weli ma jiraan warbixinno la xushay.",
      pinned: "La xushay",
      pin: "Xulo warbixin",
      unpin: "Ka saar xulashada",
      today: "Maanta",
      yesterday: "Shalay",
      filters: {
        all: "Dhammaan",
        banking: "Banka",
        accounting: "Xisaabaad",
        rent: "Kirada",
        property: "Hanti",
      },
      groups: {
        banking: {
          title: "Banka",
          items: {
            bankSummary: { name: "Kooban Bangi", desc: "Dulmar lacag soo gashay iyo baxday" },
            accountTransactions: { name: "Xawaaladaha Xisaabta", desc: "Soo saar ledger buuxa" },
            pnl: { name: "Faa'iido & Khasaaro", desc: "Dakhli vs kharash dhismo kasta." },
            bankImports: { name: "Soo dejinta Bangiga", desc: "Heshiisiiyay vs aan la heshiisiin." },
            bankReconciliation: { name: "Heshiisiinta Bangiga", desc: "Dheelliga buugga vs bangiga." },
            manualPayments: {
              name: "Lacag Bixino Gacan",
              desc: "Diwaan geli lacagaha deganaha ee ka baxsan bangiga.",
            },
          },
        },
        accounting: {
          title: "Xisaabaadka",
          items: {
            balanceSheet: { name: "Warbixinta Dheelliga", desc: "Sawir hanti vs dayn." },
            cashflow: { name: "Socodka Lacagta", desc: "Sida lacagtu u dhaqaaqdo hawl kasta." },
            trialBalance: { name: "Imtixaanka Dheelliga", desc: "Deymaha vs amaahda xisaab walba." },
            generalLedger: { name: "Ledger-ka Guud", desc: "Xisaab kasta oo faahfaahsan." },
            journalEntries: { name: "Gunnada Buugga", desc: "Diiwaanno iyo sixid." },
            chartOfAccounts: { name: "Liiska Xisaabaadka", desc: "Tixraaca xisaabaadka." },
          },
        },
        rent: {
          title: "Bixinta Kirada",
          items: {
            rentRoll: { name: "Rent Roll", desc: "Dulmar lacag la qaatay vs la bixiyay." },
            rentLedger: { name: "Ledger-ka Kirada", desc: "Lacagaha la helay vs kuwa la rabay." },
            overdueRent: { name: "Kiro Dib U Dhacday", desc: "Deganayaasha dib u dhacay & lacagaha." },
            rentCharges: { name: "Eedeymaha Kiro", desc: "Habaynta la qorsheeyay." },
            deposits: { name: "Amanada", desc: "Amanada la hayo vs la sii daayay." },
          },
        },
        property: {
          title: "Maamulka Hantida",
          items: {
            occupancy: {
              name: "Deggenaansho & Bannaani",
              desc: "La soco diyaarinta unugyada & maalmaha bannaan.",
            },
            leaseExpiry: { name: "Dhaca Heshiiska", desc: "Heshiisyada dhici doona dhawaan." },
            tenantLedger: {
              name: "Ledger-ka Deganaha",
              desc: "Lacagaha iyo qoraallada degane kasta.",
            },
            unitFinancials: { name: "Xisaabaadka Unugga", desc: "Dakhli vs kharash unug walba." },
            maintenance: { name: "Dayactir", desc: "Tigidhada & heerka xallinta." },
            utilityCharges: { name: "Biilasha Adeegyada", desc: "Biyaha & korontada oo la xisaabiyay." },
            ownerSummary: {
              name: "Kooban Mulkiile",
              desc: "Kirada, kharashaadka, iyo faa'iidada mulkiile kasta.",
            },
            kpiDashboard: { name: "KPI Dashboard", desc: "Tusmooyinka deggenaanshaha iyo faa'iidada." },
            monthEnd: { name: "Xiritaanka Bisha", desc: "Liiska hubinta ee dhismooyinka." },
            supplierDirectory: {
              name: "Buugga Alaab-qeybiyeyaasha",
              desc: "Ganacsatada & macluumaadkooda.",
            },
          },
        },
      },
    },
    skyCafe: {
      title: "Sky Café",
      subtitle: "Ku soo dhawoow barnaamijka Sky Café.",
    },
    integrations: {
      title: "Isdhexgalka Xogta",
      subtitle: "Soo dejiso CSV-yadii ugu dambeeyay ee quudiya dashboard-kan.",
      updatedLabel: "La cusboonaysiiyay",
      sizeLabel: "Cabbirka faylka",
      statusLabel: "Xaalad",
      checkedLabel: "La hubiyay",
      statusActive: "Firfircoon · faylka waa la helay",
      statusMissing: "Maqan · faylka lama helin",
      download: "Soo dejiso CSV",
      empty: "CSV lagama helin galkaan.",
      filenameLabel: "Magaca faylka",
      files: {
        bank_all_buildings_simple: {
          label: "Xawaaladaha bangiga (fudud)",
          desc: "Waxay quudiyaan ledger-ka, lacagaha, iyo bayaannada deganaha.",
        },
        bank_balances: {
          label: "Dheelliga bangiga maalin kasta",
          desc: "Looga faa'iideysto dashboard-ka iyo warbixinta bangiga.",
        },
        bank_import_summary: {
          label: "Kooban soo dejinta bangiga",
          desc: "Waxay taageertaa dib-u-heshiisiinta iyo isbarbardhigga.",
        },
        bank_reconciliation_items: {
          label: "Qodobada aan la isu keenin",
          desc: "Looga baahan yahay warbixinaha xisaabaadka.",
        },
        deposit_transactions: {
          label: "Xawaaladaha amaanada",
          desc: "Waxay quudiyaan socodka amanada iyo warbixinaha.",
        },
        journal_entries: {
          label: "Diiwaannada buugga",
          desc: "Waxay taageertaa dhoofinta xisaabaadka.",
        },
        kpi_dashboard: {
          label: "Tusmooyinka KPI",
          desc: "Xogta dashboard-ka KPI.",
        },
        maintenance_tickets: {
          label: "Tigidhada dayactirka",
          desc: "Looga isticmaalo warbixinta dayactirka.",
        },
        month_end_tasks: {
          label: "Hawlaha dhammaadka bisha",
          desc: "Waxay maamulaan liiska hubinta bisha.",
        },
        monthly_owner_summary: {
          label: "Kooban bille mulkiile",
          desc: "Waxay quudiyaan bayaannada mulkiilayaasha.",
        },
        properties_all_buildings: {
          label: "Liiska hantida",
          desc: "Waxay taageertaa bogga iyo API-ga hantida.",
        },
        tenant_charges: {
          label: "Eedeymaha deganaha",
          desc: "Looga baahan yahay bayaannada deganaha.",
        },
        tenant_deposits: {
          label: "Amanada deganaha",
          desc: "Waxay quudiyaan warbixinta amanada.",
        },
        tenants_all_buildings_simple_unique: {
          label: "Liiska deganayaasha",
          desc: "Waxay taageertaa albaabka deganaha iyo warbixinaha.",
        },
        unit_expenses: {
          label: "Kharashaadka unugyada",
          desc: "Looga isticmaalo warbixinta kharashaadka unugyada.",
        },
        unit_inventory: {
          label: "Liiska unugyada",
          desc: "Waxay quudiyaan API-ga diyaarinta unugyada.",
        },
        unit_turnover: {
          label: "Isbeddelka unugyada",
          desc: "Looga isticmaalo warbixinta isbeddelka.",
        },
        units_master_66: {
          label: "Masters-ka unugyada",
          desc: "Xogta aasaaska ee xogta unugyada.",
        },
      },
    },
  },
} as const;

function resolveValue(tree: TranslationTree, path: string[]): string | undefined {
  return path.reduce<any>((acc, segment) => {
    if (acc && typeof acc === "object" && !Array.isArray(acc)) {
      return acc[segment];
    }
    return undefined;
  }, tree) as string | undefined;
}

function format(template: string, replacements?: Replacements) {
  if (!replacements) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(replacements, key) ? String(replacements[key]) : `{${key}}`,
  );
}

export function createTranslator(language: Language) {
  return (key: string, replacements?: Replacements) => {
    const path = key.split(".");
    const langTree = TRANSLATIONS[language] as TranslationTree;
    let value = resolveValue(langTree, path);
    if (typeof value !== "string") {
      value = resolveValue(TRANSLATIONS.en as TranslationTree, path);
    }
    if (typeof value !== "string") {
      return key;
    }
    return format(value, replacements);
  };
}

export function normalizeLanguage(value?: string | null): Language {
  return value === "so" ? "so" : "en";
}
