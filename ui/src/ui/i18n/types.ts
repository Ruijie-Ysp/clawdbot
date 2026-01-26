/**
 * i18n type definitions for Clawdbot UI
 */

export type TranslationKey = string;

export type Locale = "en" | "zh-CN";

export interface Translations {
  // Language
  language: {
    name: string;
    native: string;
  };
  // Common
  common: {
    send: string;
    cancel: string;
    save: string;
    delete: string;
    edit: string;
    copy: string;
    refresh: string;
    loading: string;
    success: string;
    error: string;
    search: string;
    clear: string;
    close: string;
    open: string;
    retry: string;
    stop: string;
    queued: string;
    message: string;
    docs: string;
    yes: string;
    no: string;
    na: string;
    never: string;
    enabled: string;
    disabled: string;
    active: string;
    pending: string;
    on: string;
    off: string;
    refreshing: string;
    saving: string;
    applying: string;
    updating: string;
    working: string;
    installing: string;
    importing: string;
    add: string;
    remove: string;
    run: string;
    runs: string;
    export: string;
    filter: string;
    all: string;
    default: string;
    useDefault: string;
    none: string;
    unknown: string;
    status: string;
    mode: string;
    actions: string;
    select: string;
    view: string;
    connect: string;
    disconnect: string;
    apply: string;
    update: string;
    reload: string;
    enable: string;
    disable: string;
  };
  // App shell
  app: {
    navExpand: string;
    navCollapse: string;
    brandSubtitle: string;
    errors: {
      disconnected: string;
      noReason: string;
      eventGap: string;
    };
  };
  // Navigation
  nav: {
    control: string;
    agent: string;
    overview: string;
    chat: string;
    channels: string;
    config: string;
    sessions: string;
    logs: string;
    skills: string;
    cron: string;
    debug: string;
    nodes: string;
    devices: string;
    presence: string;
    settings: string;
    resources: string;
    instances: string;
  };
  // Navigation groups
  navGroups: {
    control: string;
    agent: string;
    settings: string;
    resources: string;
    chat: string;
  };
  // Page subtitles
  pageSubtitles: {
    overview: string;
    channels: string;
    instances: string;
    sessions: string;
    cron: string;
    skills: string;
    nodes: string;
    chat: string;
    config: string;
    debug: string;
    logs: string;
  };
  // Time formatting
  time: {
    justNow: string;
    secondsAgo: string;
    minutesAgo: string;
    hoursAgo: string;
    daysAgo: string;
    millisecondsShort: string;
    secondsShort: string;
    minutesShort: string;
    hoursShort: string;
    daysShort: string;
  };
  // Chat
  chat: {
    send: string;
    queue: string;
    newSession: string;
    abort: string;
    defaultAssistantName: string;
    inputPlaceholder: string;
    compacting: string;
    compacted: string;
    focusMode: string;
    exitFocusMode: string;
    sidebarOpen: string;
    sidebarClose: string;
    disconnected: string;
    disabled: string;
    sendButton: string;
    queueButton: string;
    abortButton: string;
    abortTooltip: string;
    newSessionTooltip: string;
    newSessionTitle: string;
    focusModeTooltip: string;
    focusModeActive: string;
    exitFocusModeTooltip: string;
    thinking: string;
    refreshHistory: string;
    toggleThinking: string;
    toggleThinkingDisabled: string;
    toggleFocus: string;
    toggleFocusDisabled: string;
    errorMessage: string;
    errorFallback: string;
  };
  // Overview
  overview: {
    title: string;
    gatewayStatus: string;
    connected: string;
    disconnected: string;
    uptime: string;
    activeSessions: string;
    recentActivity: string;
    access: {
      title: string;
      subtitle: string;
      websocketUrl: string;
      token: string;
      password: string;
      sessionKey: string;
      wsPlaceholder: string;
      tokenPlaceholder: string;
      passwordPlaceholder: string;
      connectHint: string;
    };
    authHint: {
      missingCredentials: string;
      tokenizedUrl: string;
      setToken: string;
      docsLabel: string;
      docsTitle: string;
      failedIntro: string;
      failedOutro: string;
    };
    insecureHint: {
      httpBlocked: string;
      useHttps: string;
      allowInsecure: string;
      docsServeLabel: string;
      docsServeTitle: string;
      docsInsecureLabel: string;
      docsInsecureTitle: string;
    };
    snapshot: {
      title: string;
      subtitle: string;
      statusLabel: string;
      tickIntervalLabel: string;
      lastChannelsRefreshLabel: string;
      noChannelsHint: string;
    };
    stats: {
      instancesLabel: string;
      instancesHelp: string;
      sessionsLabel: string;
      sessionsHelp: string;
      cronLabel: string;
      cronEnabled: string;
      cronDisabled: string;
      nextWake: string;
    };
    notes: {
      title: string;
      subtitle: string;
      tailscaleTitle: string;
      tailscaleBody: string;
      sessionTitle: string;
      sessionBody: string;
      cronTitle: string;
      cronBody: string;
    };
  };
  // Channels
  channels: {
    title: string;
    whatsapp: string;
    telegram: string;
    discord: string;
    slack: string;
    signal: string;
    imessage: string;
    googleChat: string;
    addChannel: string;
    connect: string;
    disconnect: string;
    connected: string;
    disconnected: string;
    pending: string;
    healthTitle: string;
    healthSubtitle: string;
    noSnapshot: string;
    genericSubtitle: string;
    accountCount: string;
    labels: {
      configured: string;
      running: string;
      connected: string;
      linked: string;
      lastConnect: string;
      lastMessage: string;
      authAge: string;
      lastInbound: string;
      lastStart: string;
      lastProbe: string;
      mode: string;
      baseUrl: string;
      credential: string;
      audience: string;
      publicKey: string;
      profile: string;
      name: string;
      displayName: string;
      about: string;
      nip05: string;
    };
    probe: {
      ok: string;
      failed: string;
      action: string;
    };
    whatsappCard: {
      subtitle: string;
      showQr: string;
      relink: string;
      waitForScan: string;
      logout: string;
      loggedOut: string;
      qrAlt: string;
    };
    telegramCard: {
      subtitle: string;
    };
    discordCard: {
      subtitle: string;
    };
    slackCard: {
      subtitle: string;
    };
    signalCard: {
      subtitle: string;
    };
    imessageCard: {
      subtitle: string;
    };
    googleChatCard: {
      subtitle: string;
    };
    nostrCard: {
      subtitle: string;
      profileTitle: string;
      editProfile: string;
      profilePictureAlt: string;
      noProfile: string;
    };
  };
  // Nostr profile
  nostrProfile: {
    title: string;
    accountLabel: string;
    usernameLabel: string;
    displayNameLabel: string;
    bioLabel: string;
    avatarLabel: string;
    bannerLabel: string;
    websiteLabel: string;
    nip05Label: string;
    lightningLabel: string;
    advancedLabel: string;
    savePublish: string;
    saving: string;
    import: string;
    importing: string;
    showAdvanced: string;
    hideAdvanced: string;
    cancel: string;
    unsavedChanges: string;
    profilePreviewAlt: string;
    placeholders: {
      username: string;
      displayName: string;
      bio: string;
      avatar: string;
      banner: string;
      website: string;
      nip05: string;
      lightning: string;
    };
    help: {
      username: string;
      displayName: string;
      bio: string;
      avatar: string;
      banner: string;
      website: string;
      nip05: string;
      lightning: string;
    };
  };
  // Instances
  instances: {
    title: string;
    subtitle: string;
    noInstances: string;
    noPresencePayload: string;
    unknownHost: string;
    scopesCount: string;
    scopesList: string;
    lastInput: string;
    reason: string;
  };
  // Sessions
  sessions: {
    title: string;
    list: string;
    create: string;
    select: string;
    delete: string;
    confirmDelete: string;
    subtitle: string;
    activeWithin: string;
    limit: string;
    includeGlobal: string;
    includeUnknown: string;
    storeLabel: string;
    headers: {
      key: string;
      label: string;
      kind: string;
      updated: string;
      tokens: string;
      thinking: string;
      verbose: string;
      reasoning: string;
      actions: string;
    };
    noSessions: string;
    optionalPlaceholder: string;
    options: {
      inherit: string;
      off: string;
      on: string;
      stream: string;
      minimal: string;
      low: string;
      medium: string;
      high: string;
      offExplicit: string;
    };
  };
  // Cron
  cron: {
    schedulerTitle: string;
    schedulerSubtitle: string;
    enabledLabel: string;
    jobsLabel: string;
    nextWakeLabel: string;
    newJobTitle: string;
    newJobSubtitle: string;
    fields: {
      name: string;
      description: string;
      agentId: string;
      enabled: string;
      schedule: string;
      session: string;
      wakeMode: string;
      payload: string;
      systemText: string;
      agentMessage: string;
      deliver: string;
      channel: string;
      to: string;
      timeoutSeconds: string;
      postToMainPrefix: string;
      runAt: string;
      every: string;
      unit: string;
      expression: string;
      timezoneOptional: string;
    };
    scheduleKinds: {
      every: string;
      at: string;
      cron: string;
    };
    sessionTargets: {
      main: string;
      isolated: string;
    };
    wakeModes: {
      nextHeartbeat: string;
      now: string;
    };
    payloadKinds: {
      systemEvent: string;
      agentTurn: string;
    };
    units: {
      minutes: string;
      hours: string;
      days: string;
    };
    placeholders: {
      agentId: string;
      to: string;
    };
    channelLast: string;
    agentLabel: string;
    errors: {
      invalidRunTime: string;
      invalidIntervalAmount: string;
      cronExprRequired: string;
      systemTextRequired: string;
      agentMessageRequired: string;
      nameRequired: string;
    };
    addJob: string;
    jobsTitle: string;
    jobsSubtitle: string;
    noJobs: string;
    runsTitle: string;
    runsSubtitle: string;
    runsSelectJob: string;
    runsEmpty: string;
    noRuns: string;
    stateSummary: string;
    scheduleAt: string;
    scheduleEvery: string;
    scheduleCron: string;
    payloadSystem: string;
    payloadAgent: string;
  };
  // Skills
  skills: {
    title: string;
    subtitle: string;
    filterLabel: string;
    filterPlaceholder: string;
    shownCount: string;
    noSkills: string;
    status: {
      eligible: string;
      blocked: string;
      disabled: string;
    };
    messages: {
      enabled: string;
      disabled: string;
      apiKeySaved: string;
      installed: string;
    };
    missingLabel: string;
    reasonLabel: string;
    reasons: {
      disabled: string;
      blockedByAllowlist: string;
    };
    enable: string;
    disable: string;
    installing: string;
    apiKey: string;
    saveKey: string;
  };
  // Nodes
  nodes: {
    title: string;
    subtitle: string;
    noneFound: string;
    status: {
      paired: string;
      unpaired: string;
      connected: string;
      offline: string;
    };
    devices: {
      title: string;
      subtitle: string;
      pending: string;
      paired: string;
      none: string;
      approve: string;
      reject: string;
      confirmReject: string;
      promptToken: string;
      confirmRevoke: string;
      roleLabel: string;
      requested: string;
      repairSuffix: string;
      tokens: string;
      tokensNone: string;
      rolesLabel: string;
      scopesLabel: string;
      rotate: string;
      revoke: string;
      tokenStatus: {
        active: string;
        revoked: string;
      };
    };
    bindings: {
      title: string;
      subtitle: string;
      formWarning: string;
      loadHint: string;
      loadButton: string;
      defaultTitle: string;
      defaultSubtitle: string;
      nodeLabel: string;
      anyNode: string;
      noNodes: string;
      noAgents: string;
      agentDefault: string;
      agentRegular: string;
      usesDefault: string;
      override: string;
      bindingLabel: string;
    };
    execApprovals: {
      title: string;
      subtitle: string;
      loadHint: string;
      loadButton: string;
      targetTitle: string;
      targetSubtitle: string;
      hostLabel: string;
      gateway: string;
      node: string;
      nodeLabel: string;
      selectNode: string;
      noNodes: string;
      scopeLabel: string;
      defaults: string;
      securityTitle: string;
      securitySubtitleDefault: string;
      securitySubtitleValue: string;
      modeLabel: string;
      useDefault: string;
      askTitle: string;
      askSubtitleDefault: string;
      askSubtitleValue: string;
      askFallbackTitle: string;
      askFallbackSubtitleDefault: string;
      askFallbackSubtitleValue: string;
      fallbackLabel: string;
      autoAllowTitle: string;
      autoAllowSubtitleDefault: string;
      autoAllowUsingDefault: string;
      autoAllowOverride: string;
      enabledLabel: string;
      allowlistTitle: string;
      allowlistSubtitle: string;
      addPattern: string;
      noAllowlist: string;
      newPattern: string;
      lastUsed: string;
      patternLabel: string;
      errors: {
        selectNodeLoad: string;
        selectNodeSave: string;
        hashMissing: string;
      };
    };
    execApprovalsOptions: {
      security: {
        deny: string;
        allowlist: string;
        full: string;
      };
      ask: {
        off: string;
        onMiss: string;
        always: string;
      };
    };
  };
  // Debug
  debug: {
    snapshotsTitle: string;
    snapshotsSubtitle: string;
    statusLabel: string;
    healthLabel: string;
    heartbeatLabel: string;
    manualRpcTitle: string;
    manualRpcSubtitle: string;
    methodLabel: string;
    methodPlaceholder: string;
    paramsLabel: string;
    callButton: string;
    modelsTitle: string;
    modelsSubtitle: string;
    eventLogTitle: string;
    eventLogSubtitle: string;
    noEvents: string;
  };
  // Logs
  logs: {
    title: string;
    clear: string;
    download: string;
    subtitle: string;
    exportLabel: string;
    exportScope: {
      filtered: string;
      visible: string;
    };
    filterLabel: string;
    filterPlaceholder: string;
    autoFollow: string;
    fileLabel: string;
    truncated: string;
    noEntries: string;
  };
  // Config
  config: {
    title: string;
    gateway: string;
    models: string;
    agents: string;
    saveConfig: string;
    saveSuccess: string;
    reloadConfig: string;
    sidebarTitle: string;
    validity: {
      valid: string;
      invalid: string;
      unknown: string;
    };
    searchPlaceholder: string;
    allSettings: string;
    mode: {
      form: string;
      raw: string;
    };
    changes: {
      none: string;
      unsaved: string;
      unsavedCount: string;
      unsavedCountPlural: string;
    };
    diff: {
      viewPending: string;
      viewPendingPlural: string;
    };
    rawLabel: string;
    loadingSchema: string;
    formUnsafe: string;
    errors: {
      hashMissing: string;
    };
    sections: Record<string, { label: string; description: string }>;
  };
  // Config form
  configForm: {
    schemaUnavailable: string;
    schemaUnavailableRaw: string;
    channelSchemaUnavailable: string;
    unsupportedSchema: string;
    unsupportedNode: string;
    unsupportedType: string;
    unsupportedArray: string;
    noSettingsMatch: string;
    noSettingsInSection: string;
    resetDefault: string;
    defaultPlaceholder: string;
    selectPlaceholder: string;
    add: string;
    addEntry: string;
    removeItem: string;
    removeEntry: string;
    itemsCountSingle: string;
    itemsCountPlural: string;
    noItems: string;
    customEntries: string;
    noCustomEntries: string;
    keyPlaceholder: string;
    jsonPlaceholder: string;
  };
  // Markdown sidebar
  markdownSidebar: {
    title: string;
    close: string;
    viewRawText: string;
    noContent: string;
  };
  // Exec approvals
  execApproval: {
    title: string;
    expiresIn: string;
    expired: string;
    pending: string;
    host: string;
    agent: string;
    session: string;
    cwd: string;
    resolved: string;
    security: string;
    ask: string;
    allowOnce: string;
    allowAlways: string;
    deny: string;
  };
  // Language Switcher
  languageSwitcher: {
    label: string;
    english: string;
    chinese: string;
  };
  // Header
  header: {
    health: string;
    ok: string;
    offline: string;
  };
  // Theme
  theme: {
    label: string;
    system: string;
    light: string;
    dark: string;
    systemLabel: string;
    lightLabel: string;
    darkLabel: string;
  };
}
