export const paths = {
	userDataDir: "userData",
	algoPath: "algo.csv",
	envPath: ".env.json"
};

export function getPath(path: string) {
	return `${__dirname}\\${path}`;
}
