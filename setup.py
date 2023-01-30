from setuptools import setup

setup(
    name='QualCmp',
    version='0.0.1',
    description='This is comar\'s python libray for personal purpose',
    author='KimGeonUng',
    author_email='saywooong@gmail.com',
    packages=[
        'QualCmp',
    ], 
    entry_points={
        'console_scripts': [
            'QualCmp = QualCmp:run_qualcmp',
        ],
    },
    include_package_data=True,
)
