import {
    App,
    Plugin,
    PluginSettingTab,
    Setting,
    TFolder,
    TFile,
    Notice,
    ButtonComponent,
    MarkdownPostProcessorContext,
    Modal,
} from 'obsidian';

interface RandomTaggedNoteSettings {
    folder: string;
    progress: Record<string, NoteProgress>;
    activeSession: PracticeSession | null;
}

interface NoteProgress {
    attempts: number;
    correctAnswers: number;
    lastAttempt: string;
}

interface TagProgress {
    tag: string;
    totalNotes: number;
    totalAttempts: number;
    correctAnswers: number;
}

interface PracticeSession {
    currentFolder: string;
    currentTags: string[];
    lastFilePath: string;
}

interface SessionStats {
    questionsAttempted: { noteName: string; correct: boolean }[];
}

const DEFAULT_SETTINGS: RandomTaggedNoteSettings = {
    folder: '',
    progress: {},
    activeSession: null,
};

export default class RandomTaggedNotePlugin extends Plugin {
    settings: RandomTaggedNoteSettings;
    session: PracticeSession | null = null; // Store the session data
    private tagCache = new Map<string, string[]>();
    private statusBarItem: HTMLElement;

    async onload() {
        await this.loadSettings();

        // Register Markdown code block processor
        this.registerMarkdownCodeBlockProcessor('progress-tracker', this.progressTrackerProcessor.bind(this));

        const ribbonIcon = this.addRibbonIcon('dice', 'Practice Session', () => {
            this.showSelectionModal();
        });
        
        const indicator = ribbonIcon.createEl('div', {
            cls: 'session-indicator',
            attr: { style: 'display: none;' }
        });

        this.addSettingTab(new RandomTaggedNoteSettingTab(this.app, this));

        this.statusBarItem = this.addStatusBarItem();
        this.statusBarItem.hide();
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    showSelectionModal() {
        this.updateStatusBar();
        const ribbonIcon = this.addRibbonIcon('dice', 'Practice Session', () => {
            this.showSelectionModal();
        });
        ribbonIcon.querySelector('.session-indicator')?.toggleAttribute('style', this.session ? 'display: block;' : 'display: none;');
        
        this.session = null;
        this.updateStatusBar();
        ribbonIcon.querySelector('.session-indicator')?.setAttribute('style', 'display: none;');

        new FolderSelectionModal(this.app, this, async (folder) => {
            // Initialize session
            this.session = {
                currentFolder: folder,
                currentTags: [],
                lastFilePath: '',
            };
            this.settings.activeSession = this.session;
            await this.saveSettings();

            const folderObj = folder === '/'
                ? this.app.vault.getRoot()
                : this.app.vault.getAbstractFileByPath(folder);

            if (!(folderObj instanceof TFolder)) {
                new Notice('Selected folder not found');
                this.session = null;
                return;
            }

            const tagsInFolder = await this.getTagsInFolder(folderObj);

            if (tagsInFolder.length === 0) {
                new Notice('No tags found in the selected folder');
                this.session = null;
                return;
            }

            new TagSelectionModal(this.app, this, folderObj, tagsInFolder, (selectedTags) => {
                if (selectedTags.length === 0) {
                    new Notice('Please select at least one tag');
                    this.session = null;
                    return;
                }
                this.session!.currentTags = selectedTags;
                this.showRandomNote();
            }).open();
        }).open();
    }

    // Get all tags within a folder
    async getTagsInFolder(folder: TFolder): Promise<string[]> {
        const cacheKey = folder.path;
        if (this.tagCache.has(cacheKey)) {
            return this.tagCache.get(cacheKey)!;
        }

        const tags = new Set<string>();
        const files = await this.getAllNotesInFolder(folder);

        for (const file of files) {
            const fileTags = this.getFileTags(file);
            fileTags.forEach((tag) => tags.add(tag));
        }

        this.tagCache.set(cacheKey, Array.from(tags));
        return Array.from(tags).sort();
    }

    // Get all notes in a folder
    async getAllNotesInFolder(folder: TFolder): Promise<TFile[]> {
        const files: TFile[] = [];
        const traverseFolder = (folder: TFolder) => {
            for (const child of folder.children) {
                if (child instanceof TFile && child.extension === 'md') {
                    files.push(child);
                } else if (child instanceof TFolder) {
                    traverseFolder(child);
                }
            }
        };

        traverseFolder(folder);
        return files;
    }

    // Function to get tags from a file
    getFileTags(file: TFile): Set<string> {
        const tags = new Set<string>();
        const metadata = this.app.metadataCache.getFileCache(file);

        if (metadata?.tags) {
            metadata.tags.forEach((tag) => {
                tags.add(tag.tag.toLowerCase().replace('#', ''));
            });
        }
        if (metadata?.frontmatter && metadata.frontmatter.tags) {
            const frontmatterTags = Array.isArray(metadata.frontmatter.tags)
                ? metadata.frontmatter.tags
                : [metadata.frontmatter.tags];
            frontmatterTags.forEach((tag: string) => {
                tags.add(tag.toLowerCase().replace('#', ''));
            });
        }

        return tags;
    }

    // Function to display a note based on least correct attempts
    async showRandomNote() {
        if (!this.session) {
            new Notice('No active session found. Please start a new practice session.');
            return;
        }

        const folderObj = this.session.currentFolder === '/'
            ? this.app.vault.getRoot()
            : this.app.vault.getAbstractFileByPath(this.session.currentFolder);

        if (!(folderObj instanceof TFolder)) {
            new Notice('Selected folder not found');
            this.session = null;
            return;
        }

        const notes = await this.getNotesWithTags(folderObj, this.session.currentTags);

        if (notes.length === 0) {
            new Notice('No notes found with the selected tags in the folder');
            this.session = null;
            return;
        }

        const notesExcludingLast = notes.filter((note) => note.path !== this.session!.lastFilePath);

        // Find the minimum number of correct attempts among the notes
        let minCorrect = Infinity;
        for (const note of notesExcludingLast) {
            const progress = this.settings.progress[note.path] || { correctAnswers: 0 };
            if (progress.correctAnswers < minCorrect) {
                minCorrect = progress.correctAnswers;
            }
        }

        // Collect notes with the minimum correct attempts
        const candidateNotes = notesExcludingLast.filter((note) => {
            const progress = this.settings.progress[note.path] || { correctAnswers: 0 };
            return progress.correctAnswers === minCorrect;
        });

        // Randomly select one of the candidate notes
        const nextNote = candidateNotes[Math.floor(Math.random() * candidateNotes.length)];

        this.session.lastFilePath = nextNote.path;

        await this.app.workspace.getLeaf().openFile(nextNote);
    }

    // Function to get notes matching the specified tags in a folder
    async getNotesWithTags(folder: TFolder, tags: string[]): Promise<TFile[]> {
        const files = await this.getAllNotesInFolder(folder);
        const matchingNotes: TFile[] = [];

        for (const file of files) {
            const fileTags = this.getFileTags(file);
            const searchTags = tags.map((t) => t.toLowerCase().replace('#', ''));

            if (searchTags.every((tag) => fileTags.has(tag))) {
                matchingNotes.push(file);
            }
        }

        return matchingNotes;
    }
    progressTrackerProcessor(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
        const plugin = this; // Store a reference to the plugin instance
        const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);

        if (!(file instanceof TFile)) {
            return;
        }

        const progress = plugin.settings.progress[file.path] || {
            attempts: 0,
            correctAnswers: 0,
            lastAttempt: null,
        };

        const container = el.createDiv({ cls: 'progress-tracker-container' });

        const buttonContainer = container.createDiv({ cls: 'button-container' });

        new ButtonComponent(buttonContainer)
            .setButtonText('Correct')
            .setIcon('check')
            .onClick(async () => {
                await plugin.updateProgress(file, true);
                plugin.updateStatsDisplay(file, statsContainer);
                new Notice('Marked as correct');
                // Show next note
                await plugin.showRandomNote();
            });

        // Incorrect button
        new ButtonComponent(buttonContainer)
            .setButtonText('Incorrect')
            .setIcon('x')
            .onClick(async () => {
                await plugin.updateProgress(file, false);
                plugin.updateStatsDisplay(file, statsContainer);
                new Notice('Marked as incorrect');
                // Show next note
                await plugin.showRandomNote();
            });

        // Stats display
        const statsContainer = container.createDiv({ cls: 'stats-container' });

        plugin.updateStatsDisplay(file, statsContainer);

        // Add styles
        el.createEl('style', {
            text: `
                .progress-tracker-container {
                    margin: 1em 0;
                }
                .button-container {
                    display: flex;
                    gap: 1em;
                    margin-bottom: 1em;
                }
                .stats-container {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5em;
                }
                .stats-item {
                    display: flex;
                    justify-content: space-between;
                }
                .progress-bar {
                    position: relative;
                    width: 100%;
                    height: 20px;
                    background-color: #e0e0e0;
                    border-radius: 10px;
                    overflow: hidden;
                }
                .progress-bar-inner {
                    position: absolute;
                    top: 0;
                    left: 0;
                    height: 100%;
                    background-color: green;
                    transition: width 0.3s ease;
                }
                .progress-bar-incorrect {
                    background-color: red;
                }
                .number-cell {
                    text-align: center;
                }
            `,
        });

        document.addEventListener('keydown', async (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                await plugin.updateProgress(file, true);
                plugin.updateStatsDisplay(file, statsContainer);
                await plugin.showRandomNote();
            }
            if (e.ctrlKey && e.key === 'Backspace') {
                await plugin.updateProgress(file, false);
                plugin.updateStatsDisplay(file, statsContainer);
                await plugin.showRandomNote();
            }
        });
    }

    // Function to update progress data
    async updateProgress(file: TFile, correct: boolean) {
        const currentProgress = this.settings.progress[file.path] || {
            attempts: 0,
            correctAnswers: 0,
            lastAttempt: null,
        };

        this.settings.progress[file.path] = {
            attempts: currentProgress.attempts + 1,
            correctAnswers: currentProgress.correctAnswers + (correct ? 1 : 0),
            lastAttempt: new Date().toISOString(),
        };

        await this.saveSettings();
    }

    // Function to update stats display
    updateStatsDisplay(file: TFile, statsContainer: HTMLElement) {
        const progress = this.settings.progress[file.path] || {
            attempts: 0,
            correctAnswers: 0,
            lastAttempt: null,
        };

        statsContainer.empty();

        const attempts = progress.attempts;
        const correctAnswers = progress.correctAnswers;

        // Display stats in a more compact form
        const statsList = [
            { label: 'Total Attempts:', value: attempts },
            { label: 'Correct Answers:', value: correctAnswers },
            { label: 'Last Attempt:', value: progress.lastAttempt ? new Date(progress.lastAttempt).toLocaleString() : 'N/A' },
        ];

        statsList.forEach((stat) => {
            const statItem = statsContainer.createDiv({ cls: 'stats-item' });
            statItem.createSpan({ text: stat.label });
            statItem.createSpan({ text: stat.value.toString() });
        });

        // Progress bar
        const progressBarContainer = statsContainer.createDiv({ cls: 'progress-bar' });
        const progressPercentage = attempts > 0 ? (correctAnswers / attempts) * 100 : 0;

        progressBarContainer.createDiv({
            cls: 'progress-bar-inner',
            attr: {
                style: `width: ${progressPercentage}%; background-color: ${progressPercentage >= 50 ? 'green' : 'red'};`,
            },
        });
    }

    private updateStatusBar() {
        if (this.session) {
            this.statusBarItem.setText(`📚 Active session: ${this.session.currentFolder}`);
            this.statusBarItem.show();
        } else {
            this.statusBarItem.hide();
        }
    }
}

// Modal to select folder
class FolderSelectionModal extends Modal {
    plugin: RandomTaggedNotePlugin;
    folder: string;
    onSubmit: (folder: string) => void;

    constructor(app: App, plugin: RandomTaggedNotePlugin, onSubmit: (folder: string) => void) {
        super(app);
        this.plugin = plugin;
        this.folder = plugin.settings.folder || '';
        this.onSubmit = onSubmit;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: 'Select Folder' });

        let folderSelected = false;
        let nextButton: ButtonComponent;

        // Folder selection
        new Setting(contentEl)
            .setName('Folder')
            .setDesc('Select folder to search in')
            .addDropdown(async (dropdown) => {
                const folders = this.app.vault.getAllLoadedFiles()
                    .filter((file): file is TFolder => file instanceof TFolder)
                    .map((folder) => folder.path);

                folders.unshift('/'); // Add root folder

                dropdown
                    .addOptions(Object.fromEntries(folders.map((folder) => [folder, folder])))
                    .setValue(this.folder)
                    .onChange((value) => {
                        this.folder = value;
                        folderSelected = true;
                        nextButton.setDisabled(false);
                    });

                if (this.folder && folders.includes(this.folder)) {
                    folderSelected = true;
                } else {
                    folderSelected = false;
                }
            });

        new Setting(contentEl)
            .addButton((btn) =>
                btn
                    .setButtonText('Cancel')
                    .onClick(() => {
                        this.close();
                    })
            )
            .addButton((btn) => {
                nextButton = btn;
                btn.setButtonText('Next')
                    .setCta()
                    .onClick(() => {
                        if (!folderSelected || !this.folder) {
                            new Notice('Please select a folder');
                            return;
                        }
                        this.onSubmit(this.folder);
                        this.close();
                    });

                if (!folderSelected) {
                    btn.setDisabled(true);
                }
            });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// Modal to select tags and show progress overviews
class TagSelectionModal extends Modal {
    plugin: RandomTaggedNotePlugin;
    folderObj: TFolder;
    tagsInFolder: string[];
    selectedTags: Set<string>;
    onSubmit: (selectedTags: string[]) => void;

    nextButton: ButtonComponent;

    constructor(app: App, plugin: RandomTaggedNotePlugin, folderObj: TFolder, tagsInFolder: string[], onSubmit: (selectedTags: string[]) => void) {
        super(app);
        this.plugin = plugin;
        this.folderObj = folderObj;
        this.tagsInFolder = tagsInFolder;
        this.selectedTags = new Set<string>();
        this.onSubmit = onSubmit;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        // Header and instructions
        contentEl.createEl('h2', { text: 'Select Tags' });
        contentEl.createEl('p', { text: 'Click on tags to select or deselect them.' });

        // Search input with spacing
        const searchInput = contentEl.createEl('input', {
            type: 'text',
            placeholder: 'Search tags...',
            cls: 'tag-search-input'
        });

        // Tags container
        const tagsContainer = contentEl.createDiv({ cls: 'tags-container' });

        // Populate tags
        this.tagsInFolder.forEach((tag) => {
            const tagElement = tagsContainer.createSpan({
                cls: 'tag-item',
                text: tag
            });
            tagElement.addEventListener('click', () => {
                if (this.selectedTags.has(tag)) {
                    this.selectedTags.delete(tag);
                    tagElement.removeClass('tag-selected');
                } else {
                    this.selectedTags.add(tag);
                    tagElement.addClass('tag-selected');
                }
                // Enable or disable the Start Practice button
                this.nextButton.setDisabled(this.selectedTags.size === 0);
            });
        });

        new Setting(contentEl)
            .addButton((btn) =>
                btn
                    .setButtonText('Back')
                    .onClick(() => {
                        this.close();
                        this.plugin.showSelectionModal();
                    })
            )
            .addButton((btn) => {
                this.nextButton = btn;
                btn.setButtonText('Start Practice')
                    .setCta()
                    .onClick(() => {
                        if (this.selectedTags.size === 0) {
                            new Notice('Please select at least one tag');
                            return;
                        }
                        this.onSubmit(Array.from(this.selectedTags));
                        this.close();
                    });
                btn.setDisabled(true);
            });

        // Progress overviews
        await this.displayTagProgressOverview(contentEl);
        await this.displayNoteProgressOverview(contentEl);

        contentEl.createEl('style', {
            text: `
                .tag-search-input {
                    width: 100%;
                    margin: 1em 0 1.5em 0;
                    padding: 0.5em;
                }
                .tags-container {
                    gap: 0.8em;
                    margin-bottom: 2em;
                }
                .tag-item {
                    padding: 0.5em 1em;
                    background-color: var(--background-secondary);
                    border-radius: 5px;
                    cursor: pointer;
                    user-select: none;
                }
                .tag-item.tag-selected {
                    background-color: var(--interactive-accent);
                    color: var(--text-on-accent);
                }
                /* Styles for tables */
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 1em;
                }
                th, td {
                    padding: 0.75em 1em;
                    text-align: left;
                    border-bottom: 1px solid var(--background-modifier-border);
                }
                tr:nth-child(even) {
                    background-color: var(--background-modifier-alt);
                }
                tr:hover {
                    background-color: var(--background-modifier-hover);
                }
                th {
                    background-color: var(--background-secondary);
                }
                .progress-bar {
                    position: relative;
                    width: 100%;
                    height: 10px;
                    background-color: #e0e0e0;
                    border-radius: 5px;
                    overflow: hidden;
                }
                .progress-bar-inner {
                    position: absolute;
                    top: 0;
                    left: 0;
                    height: 100%;
                    background-color: green;
                    transition: width 0.3s ease;
                }
            `
        });

        // Search input event listener
        searchInput.addEventListener('input', (e) => {
            const searchTerm = (e.target as HTMLInputElement).value.toLowerCase();
            tagsContainer.findAll('.tag-item').forEach((el: HTMLElement) => {
                el.toggle(el.textContent.toLowerCase().includes(searchTerm));
            });
        });
    }

    // Display the Tag Progress Overview
    async displayTagProgressOverview(container: HTMLElement) {
        const tagProgressContainer = container.createDiv({ cls: 'tag-progress-container' });
        tagProgressContainer.createEl('h3', { text: 'Tag Progress Overview' });

        const allNotes = await this.plugin.getAllNotesInFolder(this.folderObj);

        const tagProgressMap: Map<string, TagProgress> = new Map();

        allNotes.forEach((note) => {
            const fileTags = this.plugin.getFileTags(note);
            const progress = this.plugin.settings.progress[note.path] || {
                attempts: 0,
                correctAnswers: 0,
            };

            fileTags.forEach((tag) => {
                if (!tagProgressMap.has(tag)) {
                    tagProgressMap.set(tag, {
                        tag,
                        totalNotes: 0,
                        totalAttempts: 0,
                        correctAnswers: 0,
                    });
                }

                const tagProgress = tagProgressMap.get(tag)!;
                tagProgress.totalNotes += 1;
                tagProgress.totalAttempts += progress.attempts;
                tagProgress.correctAnswers += progress.correctAnswers;
            });
        });

        const tagsTable = tagProgressContainer.createEl('table', { cls: 'tags-table' });
        const tagsTableHead = tagsTable.createEl('thead');
        const tagsTableBody = tagsTable.createEl('tbody');

        const tagsHeaderRow = tagsTableHead.createEl('tr');
        ['Tag', 'Total Notes', 'Total Attempts', 'Correct Answers', 'Progress'].forEach((header) => {
            tagsHeaderRow.createEl('th', { text: header });
        });

        Array.from(tagProgressMap.values()).forEach((tagProgress) => {
            const row = tagsTableBody.createEl('tr');
            row.createEl('td', { text: tagProgress.tag });
            row.createEl('td', { text: tagProgress.totalNotes.toString() });
            row.createEl('td', { text: tagProgress.totalAttempts.toString() });
            row.createEl('td', { text: tagProgress.correctAnswers.toString() });

            const progressCell = row.createEl('td');
            const progressBarContainer = progressCell.createDiv({ cls: 'progress-bar' });
            const progressPercentage = tagProgress.totalAttempts > 0 ? (tagProgress.correctAnswers / tagProgress.totalAttempts) * 100 : 0;

            progressBarContainer.createDiv({
                cls: 'progress-bar-inner',
                attr: {
                    style: `width: ${progressPercentage}%; background-color: ${progressPercentage >= 50 ? 'green' : 'red'};`,
                },
            });
        });
    }

    // Display the Note Progress Overview
    async displayNoteProgressOverview(container: HTMLElement) {
        const noteProgressContainer = container.createDiv({ cls: 'note-progress-container' });
        noteProgressContainer.createEl('h3', { text: 'Note Progress Overview' });

        const allNotes = await this.plugin.getAllNotesInFolder(this.folderObj);

        const notesTable = noteProgressContainer.createEl('table', { cls: 'notes-table' });
        const notesTableHead = notesTable.createEl('thead');
        const notesTableBody = notesTable.createEl('tbody');

        const notesHeaderRow = notesTableHead.createEl('tr');
        ['Note Name', 'Attempts', 'Correct Answers', 'Progress'].forEach((header) => {
            notesHeaderRow.createEl('th', { text: header });
        });

        allNotes.forEach((note) => {
            const progress = this.plugin.settings.progress[note.path] || {
                attempts: 0,
                correctAnswers: 0,
            };

            const row = notesTableBody.createEl('tr');
            row.createEl('td', { text: note.basename });
            row.createEl('td', { text: progress.attempts.toString() });
            row.createEl('td', { text: progress.correctAnswers.toString() });

            const progressCell = row.createEl('td');
            const progressBarContainer = progressCell.createDiv({ cls: 'progress-bar' });
            const progressPercentage = progress.attempts > 0 ? (progress.correctAnswers / progress.attempts) * 100 : 0;

            progressBarContainer.createDiv({
                cls: 'progress-bar-inner',
                attr: {
                    style: `width: ${progressPercentage}%; background-color: ${progressPercentage >= 50 ? 'green' : 'red'};`,
                },
            });
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// Settings tab for the plugin
class RandomTaggedNoteSettingTab extends PluginSettingTab {
    plugin: RandomTaggedNotePlugin;

    constructor(app: App, plugin: RandomTaggedNotePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Random Tagged Note Settings' });
        containerEl.createEl('p', {
            text: 'These are the default settings used when running the plugin.',
        });

        new Setting(containerEl)
            .setName('Default Folder Path')
            .setDesc('Enter the path to the folder containing your notes')
            .addText((text) =>
                text
                    .setPlaceholder('folder/subfolder')
                    .setValue(this.plugin.settings.folder)
                    .onChange(async (value) => {
                        this.plugin.settings.folder = value;
                        await this.plugin.saveSettings();
                    })
            );
    }
}

class SessionSummaryModal extends Modal {
    constructor(app: App, private stats: SessionStats) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Session Summary' });

        // Add detailed stats table
        const statsTable = contentEl.createEl('table');
        this.stats.questionsAttempted.forEach(question => {
            const row = statsTable.createEl('tr');
            row.createEl('td', { text: question.noteName });
            row.createEl('td', { text: `${question.correct ? '✅' : '❌'}` });
        });
    }
}
