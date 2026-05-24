export interface ResumeData{
    personal:{
        name:string;
        email:string;
        phone?:string;
        location?:string;
        github?:string;


    };
    summary:string;
    skills:{
        programmingLanguages:string[];
        frameworksTools:string[];
        practicesMethods:string[];
    };
    experience:Array<{
        company:string;
        title:string;
        institution:string;
        location?:string;
        dates:string;
        details:string[];
    }>;

    education:Array<{
        degree:string;
        institution:string;
        location?:string;
        dates:string;
        details:string;
    }>;
    projects?:Array<{
        name:string;
        technologies:string[];
        description:string;

    }>;
    certifications?:string[];
    languages?:string[];
}