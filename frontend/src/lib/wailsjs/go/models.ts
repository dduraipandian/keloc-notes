export namespace exporter {
	
	export class AssetDTO {
	    Path: string;
	    DataBase64: string;
	
	    static createFrom(source: any = {}) {
	        return new AssetDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Path = source["Path"];
	        this.DataBase64 = source["DataBase64"];
	    }
	}
	export class ImportedNoteDTO {
	    Title: string;
	    Content: string;
	    FolderPath: string;
	    Assets: AssetDTO[];
	
	    static createFrom(source: any = {}) {
	        return new ImportedNoteDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Title = source["Title"];
	        this.Content = source["Content"];
	        this.FolderPath = source["FolderPath"];
	        this.Assets = this.convertValues(source["Assets"], AssetDTO);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class NoteDTO {
	    Title: string;
	    Content: string;
	    FolderPath: string;
	    UpdatedAt: string;
	    Assets: AssetDTO[];
	
	    static createFrom(source: any = {}) {
	        return new NoteDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Title = source["Title"];
	        this.Content = source["Content"];
	        this.FolderPath = source["FolderPath"];
	        this.UpdatedAt = source["UpdatedAt"];
	        this.Assets = this.convertValues(source["Assets"], AssetDTO);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace keys {
	
	export class Accelerator {
	    Key: string;
	    Modifiers: string[];
	
	    static createFrom(source: any = {}) {
	        return new Accelerator(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Key = source["Key"];
	        this.Modifiers = source["Modifiers"];
	    }
	}

}

export namespace menu {
	
	export class MenuItem {
	    Label: string;
	    Role: number;
	    Accelerator?: keys.Accelerator;
	    Type: string;
	    Disabled: boolean;
	    Hidden: boolean;
	    Checked: boolean;
	    SubMenu?: Menu;
	
	    static createFrom(source: any = {}) {
	        return new MenuItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Label = source["Label"];
	        this.Role = source["Role"];
	        this.Accelerator = this.convertValues(source["Accelerator"], keys.Accelerator);
	        this.Type = source["Type"];
	        this.Disabled = source["Disabled"];
	        this.Hidden = source["Hidden"];
	        this.Checked = source["Checked"];
	        this.SubMenu = this.convertValues(source["SubMenu"], Menu);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Menu {
	    Items: MenuItem[];
	
	    static createFrom(source: any = {}) {
	        return new Menu(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Items = this.convertValues(source["Items"], MenuItem);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class MenuRefs {
	    MoveToTrash?: MenuItem;
	    EmptyTrash?: MenuItem;
	    ExportCurrentNote?: MenuItem;
	    SidebarVisible?: MenuItem;
	    NoteListVisible?: MenuItem;
	    FocusEditor?: MenuItem;
	    AppearanceLight?: MenuItem;
	    AppearanceDark?: MenuItem;
	    AppearanceSystem?: MenuItem;
	
	    static createFrom(source: any = {}) {
	        return new MenuRefs(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.MoveToTrash = this.convertValues(source["MoveToTrash"], MenuItem);
	        this.EmptyTrash = this.convertValues(source["EmptyTrash"], MenuItem);
	        this.ExportCurrentNote = this.convertValues(source["ExportCurrentNote"], MenuItem);
	        this.SidebarVisible = this.convertValues(source["SidebarVisible"], MenuItem);
	        this.NoteListVisible = this.convertValues(source["NoteListVisible"], MenuItem);
	        this.FocusEditor = this.convertValues(source["FocusEditor"], MenuItem);
	        this.AppearanceLight = this.convertValues(source["AppearanceLight"], MenuItem);
	        this.AppearanceDark = this.convertValues(source["AppearanceDark"], MenuItem);
	        this.AppearanceSystem = this.convertValues(source["AppearanceSystem"], MenuItem);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class MenuState {
	    HasSelectedNote: boolean;
	    SelectedNoteInTrash: boolean;
	    TrashHasItems: boolean;
	    SidebarVisible: boolean;
	    NoteListVisible: boolean;
	    FocusEditor: boolean;
	    Theme: string;
	
	    static createFrom(source: any = {}) {
	        return new MenuState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.HasSelectedNote = source["HasSelectedNote"];
	        this.SelectedNoteInTrash = source["SelectedNoteInTrash"];
	        this.TrashHasItems = source["TrashHasItems"];
	        this.SidebarVisible = source["SidebarVisible"];
	        this.NoteListVisible = source["NoteListVisible"];
	        this.FocusEditor = source["FocusEditor"];
	        this.Theme = source["Theme"];
	    }
	}

}

